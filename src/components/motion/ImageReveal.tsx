'use client';
/**
 * A photograph that uncovers itself: the frame wipes open with `clip-path`
 * while the image inside starts slightly over-scaled and settles to 1.
 *
 * The counter-scale is the point — without it the wipe looks like a mask
 * sliding over a static picture; with it the image reads as arriving.
 */
import { useRef, type ReactNode } from 'react';
import { EASE, gsap, useGSAP } from './gsap';

export type WipeDirection = 'up' | 'down' | 'left' | 'right';

const FROM: Record<WipeDirection, string> = {
  up: 'inset(100% 0% 0% 0%)',
  down: 'inset(0% 0% 100% 0%)',
  left: 'inset(0% 0% 0% 100%)',
  right: 'inset(0% 100% 0% 0%)',
};

export function ImageReveal({
  children,
  direction = 'up',
  delay = 0,
  className,
  /** Keeps a gentle parallax drift running after the wipe finishes. */
  drift = 0,
}: {
  children: ReactNode;
  direction?: WipeDirection;
  delay?: number;
  className?: string;
  drift?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const inner = root.firstElementChild;
      if (!inner) return;

      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const tl = gsap.timeline({
          scrollTrigger: { trigger: root, start: 'top 85%', once: true },
          delay,
        });
        tl.fromTo(
          root,
          { clipPath: FROM[direction] },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: EASE.aura },
        ).fromTo(
          inner,
          { scale: 1.18 },
          { scale: 1, duration: 1.1, ease: EASE.aura },
          '<',
        );

        const parallax = drift
          ? gsap.fromTo(
              inner,
              { yPercent: -drift * 100 },
              {
                yPercent: drift * 100,
                ease: 'none',
                scrollTrigger: {
                  trigger: root,
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: true,
                  invalidateOnRefresh: true,
                },
              },
            )
          : null;

        return () => {
          tl.scrollTrigger?.kill();
          tl.kill();
          parallax?.scrollTrigger?.kill();
          parallax?.kill();
          gsap.set([root, inner], { clearProps: 'clipPath,transform' });
        };
      });

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(root, { clipPath: 'none' });
        gsap.set(inner, { scale: 1, yPercent: 0 });
      });

      return () => mm.revert();
    },
    { scope: ref, dependencies: [direction, delay, drift] },
  );

  return (
    <div ref={ref} className={`image-reveal${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
}
