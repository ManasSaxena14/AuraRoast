'use client';
/**
 * The GSAP number-roll (Blueprint Part 15). Used for the Brew Builder price,
 * the caffeine estimate, and the checkout total — anywhere a value CHANGES and
 * the guest should notice that it changed.
 *
 * Under reduced motion this is an instant value swap (§17.2), not a fast roll.
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import { EASE, gsap, prefersReducedMotion } from './gsap';

// React commits the NEW figure as text before any effect runs, so this has to
// start the roll before the browser paints — a passive effect shows the final
// price for one frame and then rolls up to it from behind.
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function NumberRoll({
  value,
  format,
  className,
  duration = 0.5,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  /** What the span currently reads — updated every frame, not just on land. */
  const shown = useRef(value);

  // Callers write `format={(n) => formatMoney(n)}` inline, so the function is a
  // new object on every render. Held in a ref and kept OUT of the dependency
  // list: as a dependency it restarts the roll on every unrelated re-render of
  // the parent, and the price visibly stutters back to where it started.
  const formatRef = useRef(format);
  formatRef.current = format;

  useBeforePaint(() => {
    const el = ref.current;
    if (!el) return;
    if (shown.current === value) {
      el.textContent = formatRef.current(value);
      return;
    }

    // Instant swap under reduced motion (§17.2) — and also whenever the tab is
    // hidden, because rAF is paused there and a half-finished roll would leave
    // a stale price on screen when the guest comes back.
    if (prefersReducedMotion() || document.hidden) {
      shown.current = value;
      el.textContent = formatRef.current(value);
      return;
    }

    const proxy = { n: shown.current };
    const tween = gsap.to(proxy, {
      n: value,
      duration,
      ease: EASE.aura,
      onUpdate: () => {
        // Recorded as we go, so a roll interrupted by a second change picks up
        // from the figure on screen rather than jumping back.
        shown.current = proxy.n;
        el.textContent = formatRef.current(proxy.n);
      },
      onComplete: () => {
        shown.current = value;
        el.textContent = formatRef.current(value);
      },
    });
    return () => {
      tween.kill();
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={className} suppressHydrationWarning>
      {format(value)}
    </span>
  );
}
