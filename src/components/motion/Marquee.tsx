'use client';
/**
 * A ticker whose speed and direction are coupled to scroll.
 *
 * It drifts on its own so the page is never completely still, then leans into
 * whichever way the guest is scrolling and speeds up with them. The coupling
 * is what stops it reading as a decorative CSS loop — it is reacting to the
 * person, not just running.
 *
 * Velocity is normalised and clamped, so a flick of the wheel cannot launch it.
 */
import { useRef, type ReactNode } from 'react';
import { ScrollTrigger, gsap, useGSAP } from './gsap';

export function Marquee({
  children,
  /** Base drift in px/second while the page is still. */
  speed = 34,
  reverse = false,
  className,
}: {
  children: ReactNode;
  speed?: number;
  reverse?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const track = root.querySelector<HTMLElement>('.marquee__track');
      if (!track) return;

      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const half = () => track.scrollWidth / 2;
        let offset = 0;
        let direction = reverse ? -1 : 1;
        let boost = 1;

        const tick = (_t: number, deltaMs: number) => {
          offset -= (deltaMs / 1000) * speed * direction * boost;
          const width = half();
          if (width > 0) offset = ((offset % width) + width) % width;
          gsap.set(track, { x: -offset, force3D: true });
          // Ease the boost back down so it decays instead of snapping.
          boost += (1 - boost) * 0.06;
        };

        gsap.ticker.add(tick);

        const st = ScrollTrigger.create({
          trigger: root,
          start: 'top bottom',
          end: 'bottom top',
          onUpdate: (self) => {
            direction = self.direction === -1 ? (reverse ? 1 : -1) : reverse ? -1 : 1;
            boost = Math.min(9, 1 + Math.abs(self.getVelocity()) / 260);
          },
        });

        return () => {
          gsap.ticker.remove(tick);
          st.kill();
          gsap.set(track, { clearProps: 'transform' });
        };
      });

      return () => mm.revert();
    },
    { scope: ref, dependencies: [speed, reverse] },
  );

  return (
    <div ref={ref} className={`marquee${className ? ` ${className}` : ''}`} aria-hidden="true">
      <div className="marquee__track">
        {children}
        {children}
      </div>
    </div>
  );
}
