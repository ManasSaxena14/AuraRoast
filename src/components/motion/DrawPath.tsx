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

/** Progress is reported in 1% steps. Callers drive React state off this, and a
 *  raw scrub emits a new float on every single frame. */
const PROGRESS_STEP = 100;

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

  // Deliberately not a dependency: callers pass a setState or an inline
  // closure, and re-running the whole ScrollTrigger setup on every parent
  // render would re-measure and re-draw the line mid-scroll.
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      // SVGGeometryElement, not SVGPathElement: `line`, `polyline` and `circle`
      // all measure with getTotalLength() and all read as a drawn stroke.
      const paths = Array.from(root.querySelectorAll<SVGGeometryElement>('[data-draw]'));
      if (!paths.length) return;

      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // Re-measured on every refresh rather than once at mount: the viewBox
        // is fluid, so a resize changes the rendered length of the stroke and
        // a stale dasharray leaves the line either short or never closing.
        const measure = () => {
          for (const path of paths) {
            const length = path.getTotalLength();
            // A path inside a display:none ancestor measures 0. Writing
            // `dasharray: 0` there would leave the stroke solid and undrawable.
            if (!length) continue;
            gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
          }
        };
        measure();

        let lastStep = -1;
        const tweens = paths.map((path, i) =>
          gsap.to(path, {
            strokeDashoffset: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: root,
              start,
              end,
              scrub: 0.4,
              invalidateOnRefresh: true,
              onRefreshInit: i === 0 ? measure : undefined,
              // One reporter for the whole group, quantised to whole percent.
              onUpdate:
                i === 0
                  ? (self) => {
                      const step = Math.round(self.progress * PROGRESS_STEP);
                      if (step === lastStep) return;
                      lastStep = step;
                      progressRef.current?.(step / PROGRESS_STEP);
                    }
                  : undefined,
            },
          }),
        );

        return () => {
          tweens.forEach((t) => {
            t.scrollTrigger?.kill();
            t.kill();
          });
          gsap.set(paths, { clearProps: 'strokeDasharray,strokeDashoffset' });
        };
      });

      // Drawn, in full, instantly — and the caller is told the line has passed
      // everything, so any labels it gates on progress are lit rather than
      // stuck at their dimmed state (§14.7 rule 8).
      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(paths, { strokeDasharray: 'none', strokeDashoffset: 0 });
        progressRef.current?.(1);
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
