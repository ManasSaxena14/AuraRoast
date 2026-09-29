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
 *
 * Per frame it does one thing: write a transform. The loop width is measured
 * when the track resizes, never inside the tick (reading `scrollWidth` there
 * forced a synchronous layout on every frame), and the tick is detached
 * entirely while the band is off screen or the tab is hidden.
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
        const setX = gsap.quickSetter(track, 'x', 'px') as (value: number) => void;
        let half = track.scrollWidth / 2;
        let offset = 0;
        let direction = reverse ? -1 : 1;
        let boost = 1;
        let running = false;
        let visible = false;

        const ro = new ResizeObserver(() => {
          half = track.scrollWidth / 2;
        });
        ro.observe(track);

        const tick = (_t: number, deltaMs: number) => {
          offset -= (Math.min(deltaMs, 64) / 1000) * speed * direction * boost;
          if (half > 0) offset = ((offset % half) + half) % half;
          setX(-offset);
          // Ease the boost back down so it decays instead of snapping.
          boost += (1 - boost) * 0.06;
        };

        const sync = () => {
          const should = visible && !document.hidden;
          if (should && !running) gsap.ticker.add(tick);
          if (!should && running) gsap.ticker.remove(tick);
          running = should;
        };

        const st = ScrollTrigger.create({
          trigger: root,
          start: 'top bottom',
          end: 'bottom top',
          onToggle: (self) => {
            visible = self.isActive;
            sync();
          },
          onUpdate: (self) => {
            direction = self.direction === -1 ? (reverse ? 1 : -1) : reverse ? -1 : 1;
            boost = Math.min(9, 1 + Math.abs(self.getVelocity()) / 260);
          },
        });
        visible = st.isActive;
        sync();

        document.addEventListener('visibilitychange', sync);

        return () => {
          document.removeEventListener('visibilitychange', sync);
          if (running) gsap.ticker.remove(tick);
          running = false;
          ro.disconnect();
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
