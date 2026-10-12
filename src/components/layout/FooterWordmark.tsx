'use client';
/**
 * The sign-off: AURA TOAST set huge across the bottom of every page.
 *
 * Each letter rises out of the baseline as the footer scrolls into view —
 * scrubbed, so it tracks the scroll exactly — and a band of light crosses the
 * word once it has fully arrived. The letters are ours to split (static
 * text, never re-rendered), unlike page headlines.
 */
import { useRef } from 'react';
import { ScrollTrigger, gsap, useGSAP } from '@/components/motion/gsap';

const WORD = 'AURA TOAST';

export function FooterWordmark() {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const letters = el.querySelectorAll<HTMLElement>('.wordmark__l');
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const tween = gsap.fromTo(
          letters,
          { yPercent: 105, rotate: 4 },
          {
            yPercent: 0,
            rotate: 0,
            ease: 'none', // scroll-linked: the scroll is the easing
            stagger: 0.06,
            scrollTrigger: {
              trigger: el,
              start: 'top bottom',
              end: 'bottom bottom-=40',
              scrub: 0.6,
              onLeave: () => el.setAttribute('data-lit', 'true'),
              onEnterBack: () => el.removeAttribute('data-lit'),
            },
          },
        );
        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
        };
      });
      mm.add('(prefers-reduced-motion: reduce)', () => {
        el.setAttribute('data-lit', 'true');
      });
      // The footer sits under content that loads late (maps, the hero).
      const t = setTimeout(() => ScrollTrigger.refresh(), 1200);
      return () => {
        clearTimeout(t);
        mm.revert();
      };
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="wordmark" aria-hidden="true">
      {WORD.split('').map((ch, i) => (
        <span key={i} className="wordmark__mask">
          <span className="wordmark__l">{ch === ' ' ? ' ' : ch}</span>
        </span>
      ))}
    </div>
  );
}
