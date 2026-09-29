'use client';
/**
 * Velocity skew, applied globally to opted-in sections.
 *
 * The whole effect is 3 degrees at its absolute maximum and decays back to
 * zero the instant scrolling stops. Uncapped, this is the single tackiest
 * effect on the web; capped and decaying, it is the thing that makes a page
 * feel like it has mass.
 *
 * One ticker and one ScrollTrigger for the WHOLE page — not one per section.
 *
 * Why it is built the way it is — each of these was a measured source of jank:
 *
 *   · Layers are created ONCE, when the effect starts, not per gesture. It
 *     used to add `will-change` when a scroll began and remove it when it
 *     ended, which rasterised every section into a new compositor layer at the
 *     start of every flick and repainted them all into the page at the end.
 *   · Only sections actually on screen are written to (an IntersectionObserver
 *     keeps that set); a transform on something nobody can see is pure cost.
 *   · Desktop pointers only. Phones scroll with native momentum and far less
 *     GPU headroom, and a skew is invisible under a thumb anyway.
 *   · Velocity decays inside the ticker, instead of a timer re-armed on every
 *     single scroll event.
 *   · At rest the inline transform is REMOVED, not set to `skewY(0deg)`.
 */
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { ScrollTrigger, gsap } from './gsap';

const MAX_SKEW = 3;
const REST = 0.02; // below this, treat it as zero and drop the transform
const QUERY =
  '(hover: hover) and (pointer: fine) and (min-width: 1024px) and (prefers-reduced-motion: no-preference)';

export function ScrollSkew() {
  // Keyed on the route, because a client-side navigation swaps every
  // [data-skew] section without producing a ScrollTrigger refresh.
  const pathname = usePathname();

  useEffect(() => {
    const media = window.matchMedia(QUERY);
    let teardown: (() => void) | null = null;

    const setup = () => {
      teardown?.();
      teardown = media.matches ? start() : null;
    };

    function start(): () => void {
      let skew = 0;
      let target = 0;
      let applied = 0;
      const all = new Set<HTMLElement>();
      const onScreen = new Set<HTMLElement>();

      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            const el = e.target as HTMLElement;
            if (e.isIntersecting) {
              onScreen.add(el);
              if (applied) el.style.transform = `skewY(${applied}deg)`;
            } else {
              onScreen.delete(el);
              el.style.removeProperty('transform');
            }
          }
        },
        { rootMargin: '10% 0px' },
      );

      const release = (el: HTMLElement) => {
        io.unobserve(el);
        onScreen.delete(el);
        el.style.removeProperty('transform');
        el.style.removeProperty('will-change');
      };

      // Sections that mount after this runs — a client-rendered grid, a
      // streamed page — are picked up on the next ScrollTrigger refresh, which
      // every layout change of that size produces anyway.
      const collect = () => {
        const now = new Set(document.querySelectorAll<HTMLElement>('[data-skew]'));
        for (const el of all) {
          if (!now.has(el)) {
            release(el);
            all.delete(el);
          }
        }
        for (const el of now) {
          if (all.has(el)) continue;
          all.add(el);
          el.style.willChange = 'transform';
          io.observe(el);
        }
      };
      collect();
      ScrollTrigger.addEventListener('refresh', collect);

      const write = (value: number) => {
        for (const el of onScreen) {
          if (value === 0) el.style.removeProperty('transform');
          else el.style.transform = `skewY(${value}deg)`;
        }
      };

      const tick = () => {
        // Velocity readings go stale once scrolling stops; let the target
        // fall away on its own rather than waiting for a timer.
        target *= 0.86;
        // Exponential decay toward the target: no easing curve, because this
        // is driven by an external clock (§12.4).
        skew += (target - skew) * 0.12;
        const next = Math.abs(skew) < REST ? 0 : Math.round(skew * 100) / 100;
        if (next === applied) return;
        applied = next;
        write(next);
      };

      const st = ScrollTrigger.create({
        onUpdate: (self) => {
          target = gsap.utils.clamp(-MAX_SKEW, MAX_SKEW, self.getVelocity() / -480);
        },
      });

      gsap.ticker.add(tick);

      return () => {
        gsap.ticker.remove(tick);
        ScrollTrigger.removeEventListener('refresh', collect);
        st.kill();
        for (const el of all) release(el);
        io.disconnect();
      };
    }

    setup();
    media.addEventListener('change', setup);
    return () => {
      media.removeEventListener('change', setup);
      teardown?.();
    };
  }, [pathname]);

  return null;
}
