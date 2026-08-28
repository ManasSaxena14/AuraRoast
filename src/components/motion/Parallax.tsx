'use client';
/**
 * Parallax (Blueprint §14.7 rule 5): capped at 15% displacement, always
 * `transform: translate3d()`. Never `background-position`, never `top`.
 */
import { useRef, type ReactNode } from 'react';
import { gsap, useGSAP } from './gsap';

export function Parallax({
  children,
  /** 0–0.15. Values above the cap are clamped rather than honoured. */
  amount = 0.1,
  className,
}: {
  children: ReactNode;
  amount?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const capped = Math.min(0.15, Math.max(0, amount));

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const shift = el.offsetHeight * capped;
        const tween = gsap.fromTo(
          el.firstElementChild,
          { yPercent: -capped * 100 },
          {
            yPercent: capped * 100,
            ease: 'none', // scroll-linked animations never ease (§12.4)
            force3D: true,
            scrollTrigger: {
              trigger: el,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
              invalidateOnRefresh: true,
            },
          },
        );
        void shift;
        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
        };
      });

      return () => mm.revert();
    },
    { scope: ref, dependencies: [capped] },
  );

  return (
    <div ref={ref} className={`parallax${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
}
