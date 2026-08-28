'use client';
/**
 * Scroll-linked scale + rotation, for cards that should feel like they settle
 * into place rather than simply appear. Transform only, `ease: 'none'`.
 */
import { useRef, type ReactNode } from 'react';
import { gsap, useGSAP } from './gsap';

export function ScrollScale({
  children,
  from = 0.9,
  to = 1,
  rotate = 0,
  className,
}: {
  children: ReactNode;
  from?: number;
  to?: number;
  rotate?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const tween = gsap.fromTo(
          el,
          { scale: from, rotate: -rotate, opacity: 0.65 },
          {
            scale: to,
            rotate: 0,
            opacity: 1,
            ease: 'none',
            force3D: true,
            scrollTrigger: {
              trigger: el,
              start: 'top 92%',
              end: 'top 45%',
              scrub: 0.5,
              invalidateOnRefresh: true,
            },
          },
        );
        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
          gsap.set(el, { clearProps: 'all' });
        };
      });

      return () => mm.revert();
    },
    { scope: ref, dependencies: [from, to, rotate] },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
