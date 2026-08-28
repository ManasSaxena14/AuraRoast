'use client';
/**
 * An SVG path that draws itself against scroll position.
 *
 * `stroke-dashoffset` is the one non-transform property worth animating here:
 * it is a cheap, GPU-friendly paint on a single thin stroke, and there is no
 * transform-based way to draw a line along its own length.
 *
 * `ease: 'none'` — scroll-linked, so no curve (§12.4).
 */
import { useRef, type ReactNode } from 'react';
import { gsap, useGSAP } from './gsap';

export function DrawPath({
  children,
  className,
  start = 'top 80%',
  end = 'bottom 60%',
  /** Fires with 0–1 so a caller can light up labels as the line passes them. */
  onProgress,
}: {
  children: ReactNode;
  className?: string;
  start?: string;
  end?: string;
  onProgress?: (p: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const paths = Array.from(root.querySelectorAll<SVGPathElement>('[data-draw]'));
      if (!paths.length) return;

      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const tweens = paths.map((path) => {
          const length = path.getTotalLength();
          gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
          return gsap.to(path, {
            strokeDashoffset: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: root,
              start,
              end,
              scrub: 0.4,
              invalidateOnRefresh: true,
              onUpdate: onProgress ? (self) => onProgress(self.progress) : undefined,
            },
          });
        });
        return () => {
          tweens.forEach((t) => {
            t.scrollTrigger?.kill();
            t.kill();
          });
          gsap.set(paths, { clearProps: 'strokeDasharray,strokeDashoffset' });
        };
      });

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(paths, { strokeDasharray: 'none', strokeDashoffset: 0 });
        onProgress?.(1);
      });

      return () => mm.revert();
    },
    { scope: ref, dependencies: [start, end] },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
