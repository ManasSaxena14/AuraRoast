'use client';
/**
 * A number that counts up when it first scrolls into view.
 *
 * Props are deliberately SERIALIZABLE — no formatter callback — because this
 * is rendered straight from Server Components, and a function cannot cross the
 * RSC boundary. `prefix`/`suffix` cover every case the site actually has.
 *
 * Same rules as everything else: `once`, `top 85%`, and an instant final value
 * under reduced motion. It exists because a figure that lands already-final
 * reads as decoration; one that arrives reads as a fact being stated.
 */
import { useRef } from 'react';
import { EASE, gsap, prefersReducedMotion, useGSAP } from './gsap';

export function CountUp({
  value,
  duration = 1.4,
  decimals = 0,
  grouped = true,
  prefix = '',
  suffix = '',
  className,
}: {
  value: number;
  duration?: number;
  decimals?: number;
  grouped?: boolean;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  const render = (n: number) =>
    `${prefix}${n.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: grouped,
    })}${suffix}`;

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      // Instant final value under reduced motion, and in a hidden tab where
      // rAF is paused — otherwise the count would be frozen at zero when the
      // guest comes back.
      if (prefersReducedMotion() || document.hidden) {
        el.textContent = render(value);
        return;
      }

      const proxy = { n: 0 };

      // `immediateRender: false` matters: without it the tween writes 0 the
      // moment it is created, so a trigger that never fires would leave the
      // server-rendered figure permanently reading zero. The DOM is only
      // touched once the count is genuinely under way.
      const tween = gsap.fromTo(
        proxy,
        { n: 0 },
        {
          n: value,
          duration,
          ease: EASE.aura,
          immediateRender: false,
          onUpdate: () => {
            el.textContent = render(proxy.n);
          },
          onComplete: () => {
            el.textContent = render(value);
          },
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        },
      );

      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    },
    { scope: ref, dependencies: [value, duration, decimals, grouped, prefix, suffix] },
  );

  return (
    <span ref={ref} className={className} suppressHydrationWarning>
      {render(value)}
    </span>
  );
}
