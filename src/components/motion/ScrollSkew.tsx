'use client';
/**
 * Velocity skew, applied globally to opted-in sections.
 *
 * The whole effect is 4 degrees at its absolute maximum and decays back to
 * zero the instant scrolling stops. Uncapped, this is the single tackiest
 * effect on the web; capped and decaying, it is the thing that makes a page
 * feel like it has mass.
 *
 * One ticker and one ScrollTrigger for the WHOLE page — not one per section.
 *
 * Two details that matter more than they look:
 *   · the target list is cached and only rebuilt on refresh or navigation. A
 *     `querySelectorAll` across the document on every frame is a real cost.
 *   · at rest the inline transform is REMOVED, not set to `skewY(0deg)`.
 *     Writing a no-op transform on hydration makes React report a mismatch
 *     against server HTML that never had one, and leaves a needless
 *     compositor layer on every section for the life of the page.
 */
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { ScrollTrigger, gsap, prefersReducedMotion } from './gsap';

const MAX_SKEW = 4;
const REST = 0.02; // below this, treat it as zero and drop the style entirely

export function ScrollSkew() {
  // Keyed on the route, because a client-side navigation swaps every
  // [data-skew] section without producing a ScrollTrigger refresh — the cached
  // list would keep writing to the outgoing page's detached nodes and the
  // arrived-at page would never skew at all.
  const pathname = usePathname();

  useEffect(() => {
    if (prefersReducedMotion()) return;

    let skew = 0;
    let target = 0;
    let applied = 0;
    let nodes: HTMLElement[] = [];

    const collect = () => {
      nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-skew]'));
    };
    collect();

    const write = (value: number) => {
      for (const el of nodes) {
        if (value === 0) {
          el.style.removeProperty('transform');
          el.style.removeProperty('will-change');
        } else {
          // Promotion is scoped and temporary for the same reason the
          // transform is (§16.3) — a static `will-change` in CSS would hand
          // every section its own compositor layer for the life of the page,
          // including for guests this effect never runs for.
          el.style.willChange = 'transform';
          el.style.transform = `skewY(${value}deg)`;
        }
      }
    };

    const tick = () => {
      // Exponential decay toward the target: no easing curve, because this is
      // driven by an external clock (§12.4).
      skew += (target - skew) * 0.12;
      const next = Math.abs(skew) < REST ? 0 : Number(skew.toFixed(3));
      if (next === applied) return;
      applied = next;
      write(next);
    };

    const st = ScrollTrigger.create({
      onUpdate: (self) => {
        target = gsap.utils.clamp(-MAX_SKEW, MAX_SKEW, self.getVelocity() / -420);
      },
      onRefresh: collect,
    });

    // Velocity readings go stale when scrolling stops; zero it out.
    let idle: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(idle);
      idle = setTimeout(() => {
        target = 0;
      }, 90);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    gsap.ticker.add(tick);

    return () => {
      clearTimeout(idle);
      window.removeEventListener('scroll', onScroll);
      gsap.ticker.remove(tick);
      st.kill();
      write(0);
    };
  }, [pathname]);

  return null;
}
