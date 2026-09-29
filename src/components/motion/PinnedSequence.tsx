'use client';
/**
 * A pinned section that steps through N beats as you scroll: the image
 * cross-fades and scales, the caption swaps, and a segmented Halo-coloured
 * progress bar fills.
 *
 * Pin length is `beats × 0.6vh` — long enough for each beat to land, short
 * enough that the guest never feels held.
 *
 * Below 640px the GSAP pin is dropped — pinning a phone for six screens of
 * scroll is a trap — but the section does NOT become a dead list. The media
 * goes `position: sticky` and an IntersectionObserver advances the beat as
 * each one passes, so the same idea survives with no pin, no duplicated
 * images, and no scroll hijacking. Reduced motion takes the same observer at
 * every width: the beats are the content, so they must still advance.
 */
import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import { ScrollTrigger, gsap, useGSAP } from './gsap';

export interface Beat {
  id: string;
  image: string;
  step: string;
  title: string;
  body: string;
}

const RING = 295.3; // 2πr for r = 47

export function PinnedSequence({ beats, eyebrow, heading }: { beats: Beat[]; eyebrow: string; heading: string }) {
  const ref = useRef<HTMLElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);

  /**
   * Called on every scroll frame while pinned. The ring is written straight to
   * the DOM, and React only hears about it when the BEAT changes — six renders
   * across the whole sequence instead of one per frame (a re-render of six
   * images and six captions, sixty times a second, was most of this
   * section's cost).
   */
  const onUpdate = useCallback(
    (p: number) => {
      ringRef.current?.setAttribute('stroke-dashoffset', String(RING * (1 - p)));
      const next = Math.min(beats.length - 1, Math.floor(p * beats.length));
      if (next !== activeRef.current) {
        activeRef.current = next;
        setActive(next);
      }
    },
    [beats.length],
  );

  useGSAP(
    () => {
      const section = ref.current;
      if (!section) return;
      const mm = gsap.matchMedia();

      // The no-pin driver: sticky media + observer. It lives on the same
      // matchMedia as the pin so the two can never both be off — sampling
      // `window.matchMedia` once at mount left a dead zone where neither ran.
      const observeBeats = () => {
        const nodes = Array.from(section.querySelectorAll<HTMLElement>('.sequence__beat'));
        if (!nodes.length) return;

        const io = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              const i = nodes.indexOf(entry.target as HTMLElement);
              if (i < 0) continue;
              activeRef.current = i;
              setActive(i);
              ringRef.current?.setAttribute('stroke-dashoffset', String(RING * (1 - (i + 1) / nodes.length)));
            }
          },
          // A band across the middle of the screen, so the beat that "counts"
          // is the one the guest is actually looking at.
          { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
        );
        nodes.forEach((n) => io.observe(n));
        return () => io.disconnect();
      };

      mm.add('(min-width: 640px) and (prefers-reduced-motion: no-preference)', () => {
        const st = ScrollTrigger.create({
          trigger: section,
          start: 'top top',
          end: () => `+=${beats.length * window.innerHeight * 0.6}`,
          pin: true,
          // No `scrub` here on purpose. With scrub, `self.progress` is the
          // ticker-interpolated value, which lags behind the real scroll
          // position — and this is a discrete beat stepper, not a tween. The
          // smoothing belongs in the CSS transitions on the frames instead.
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => onUpdate(self.progress),
        });
        return () => st.kill();
      });

      // Everything the pin does not cover — phones, and any width under
      // reduced motion. Without this second branch a desktop guest with
      // "reduce" set advances nothing: `active` stays 0, so five of six frames
      // sit at `opacity: 0` and five of six beats at `opacity: 0.32` forever
      // (§14.7 rule 8).
      mm.add('(max-width: 639px), (prefers-reduced-motion: reduce)', observeBeats);

      return () => mm.revert();
    },
    { scope: ref, dependencies: [beats.length, onUpdate], revertOnUpdate: true },
  );

  return (
    /* Wrapped for the same reason as HeroScrub: `pin` relocates this root into a
       GSAP-injected `.pin-spacer`, so it must not sit directly in a parent whose
       children React inserts into — see the note in HeroScrub.tsx. */
    <div className="pin-host">
      <section ref={ref} className="sequence" aria-label={heading}>
        <div className="shell sequence__inner">
          <header className="sequence__head">
            <p className="eyebrow">{eyebrow}</p>
            <h2>{heading}</h2>
          </header>

          <div className="sequence__stage">
            <div className="sequence__media">
              {beats.map((b, i) => (
                <div
                  key={b.id}
                  className="sequence__frame"
                  data-active={i === active || undefined}
                  aria-hidden={i !== active}
                >
                  <Image
                    src={b.image}
                    alt=""
                    width={620}
                    height={620}
                    sizes="(max-width: 639px) 90vw, 42vw"
                  />
                </div>
              ))}
              <div className="sequence__ring" aria-hidden="true">
                <svg viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="47" fill="none" stroke="var(--aura-500)" strokeWidth="0.6" opacity="0.25" />
                  <circle
                    ref={ringRef}
                    cx="50"
                    cy="50"
                    r="47"
                    fill="none"
                    stroke="var(--aura-500)"
                    strokeWidth="0.9"
                    strokeLinecap="round"
                    strokeDasharray={RING}
                    strokeDashoffset={RING}
                    transform="rotate(-90 50 50)"
                  />
                </svg>
              </div>
            </div>

            <div className="sequence__copy">
              <ol className="sequence__list">
                {beats.map((b, i) => (
                  <li key={b.id} className="sequence__beat" data-active={i === active || undefined}>
                    <span className="sequence__step mono">{b.step}</span>
                    <div>
                      <h3>{b.title}</h3>
                      <p className="muted">{b.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="sequence__bar" aria-hidden="true">
                {beats.map((b, i) => (
                  <span key={b.id} data-filled={i <= active || undefined} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
