'use client';
/**
 * The /origins horizontal pinned section (Blueprint §14.6).
 *
 * Vertical wheel translates a horizontal track; pin duration is exactly
 * `trackWidth - viewportWidth`, so the section releases the instant the track
 * runs out rather than holding the guest hostage for a round number.
 *
 * Below 640px horizontal pinning is DISABLED and the same markup falls back to
 * a scroll-snap carousel. Pinned horizontal scroll on a phone is a usability
 * trap, not a fallback.
 */
import { useRef, type ReactNode } from 'react';
import { gsap, useGSAP } from './gsap';

export function HorizontalScroll({
  children,
  className,
  onProgress,
  itemCount,
}: {
  children: ReactNode;
  className?: string;
  /** Fires with the index of the panel crossing centre — couples the map. */
  onProgress?: (index: number, progress: number) => void;
  itemCount: number;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const lastIndex = useRef(-1);

  useGSAP(
    () => {
      const section = sectionRef.current;
      const track = trackRef.current;
      if (!section || !track) return;

      const mm = gsap.matchMedia();

      mm.add('(min-width: 640px) and (prefers-reduced-motion: no-preference)', () => {
        const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);

        const tween = gsap.to(track, {
          x: () => -distance(),
          ease: 'none', // the scroll IS the timing function
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 0.5,
            invalidateOnRefresh: true,
            anticipatePin: 1,
            onUpdate: (self) => {
              // `.hscroll` is `overflow: hidden`, which the browser will still
              // scroll to reveal a focused chip in a clipped panel. GSAP owns
              // the track's x, so any scrollLeft it left behind cancels the
              // transform out — hand the box back before writing progress.
              if (section.scrollLeft) section.scrollLeft = 0;
              section.style.setProperty('--h-progress', String(self.progress));
              const idx = Math.min(
                itemCount - 1,
                Math.round(self.progress * (itemCount - 1)),
              );
              if (idx !== lastIndex.current) {
                lastIndex.current = idx;
                onProgress?.(idx, self.progress);
              }
            },
          },
        });

        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
          gsap.set(track, { clearProps: 'transform' });
        };
      });

      return () => mm.revert();
    },
    { scope: sectionRef, dependencies: [itemCount], revertOnUpdate: true },
  );

  return (
    /* Wrapped for the same reason as HeroScrub: `pin` relocates this root into a
       GSAP-injected `.pin-spacer`, so it must not sit directly in a parent whose
       children React inserts into — see the note in HeroScrub.tsx. */
    <div className="pin-host">
      <div ref={sectionRef} className={`hscroll${className ? ` ${className}` : ''}`}>
        <div ref={trackRef} className="hscroll__track origins-track">
          {children}
        </div>
      </div>
    </div>
  );
}
