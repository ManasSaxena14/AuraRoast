'use client';
/**
 * Scroll-linked scale + rotation, for cards that should feel like they settle
 * into place rather than simply appear. Transform only, `ease: 'none'`.
 *
 * The starting opacity is 0.65, never 0. A scrubbed tween holds its from-state
 * for as long as the element is below the trigger, so a zero here would mean
 * "content is invisible until you scroll to it" — which is a content bug, not
 * an animation (§14.7 rule 8).
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
              // Promote for the ~half-second it is actually being scrubbed and
              // drop the layer the moment it leaves the window (§16.3). The
              // attribute is what carries `will-change` in motion.css.
              onToggle: (self) => {
                if (self.isActive) el.dataset.animating = 'true';
                else delete el.dataset.animating;
              },
            },
          },
        );
        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
          delete el.dataset.animating;
          gsap.set(el, { clearProps: 'transform,opacity,willChange' });
        };
      });

      // The scrub never runs here, so the element keeps its own CSS — but if
      // the preference flips mid-session the from-state has to be handed back.
      mm.add('(prefers-reduced-motion: reduce)', () => {
        delete el.dataset.animating;
        gsap.set(el, { clearProps: 'transform,opacity,willChange' });
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
