'use client';
/**
 * The GSAP number-roll (Blueprint Part 15). Used for the Brew Builder price,
 * the caffeine estimate, and the checkout total — anywhere a value CHANGES and
 * the guest should notice that it changed.
 *
 * Under reduced motion this is an instant value swap (§17.2), not a fast roll.
 */
import { useEffect, useRef } from 'react';
import { EASE, gsap, prefersReducedMotion } from './gsap';

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
  const shown = useRef(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Instant swap under reduced motion (§17.2) — and also whenever the tab is
    // hidden, because rAF is paused there and a half-finished roll would leave
    // a stale price on screen when the guest comes back.
    if (prefersReducedMotion() || document.hidden) {
      shown.current = value;
      el.textContent = format(value);
      return;
    }
    const proxy = { n: shown.current };
    const tween = gsap.to(proxy, {
      n: value,
      duration,
      ease: EASE.aura,
      onUpdate: () => {
        el.textContent = format(proxy.n);
      },
      onComplete: () => {
        shown.current = value;
        el.textContent = format(value);
      },
    });
    return () => {
      tween.kill();
    };
  }, [value, format, duration]);

  return (
    <span ref={ref} className={className} suppressHydrationWarning>
      {format(value)}
    </span>
  );
}
