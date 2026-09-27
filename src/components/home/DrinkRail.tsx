'use client';
/**
 * The signature-drinks rail. `ScrollTrigger.batch` — ONE trigger for the whole
 * set, not N triggers (§14.7 rule 6) — plus the active card scaling to 1.02 as
 * it crosses centre.
 */
import { useRef } from 'react';
import { EASE, ScrollTrigger, gsap, useGSAP } from '@/components/motion/gsap';
import { DrinkCard } from '@/components/ui/DrinkCard';
import type { Drink } from '@/domain/types';

export function DrinkRail({ drinks }: { drinks: Drink[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const cards = Array.from(el.children) as HTMLElement[];
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.set(cards, { y: 26, opacity: 0 });

        const batch = ScrollTrigger.batch(cards, {
          start: 'top 85%',
          once: true,
          onEnter: (targets) =>
            gsap.to(targets, {
              y: 0,
              opacity: 1,
              duration: 0.72,
              ease: EASE.aura,
              stagger: { each: 0.04, amount: Math.min(targets.length * 0.04, 0.3) },
              onComplete: () => {
                gsap.set(targets, { clearProps: 'opacity,y' });
              },
            }),
        });

        // The card crossing centre lifts very slightly, then settles back.
        const centres = cards.map((card) => {
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: card,
              start: 'top 80%',
              end: 'bottom 20%',
              scrub: 0.3,
            },
          });
          tl.to(card, { scale: 1.02, ease: 'sine.inOut', duration: 0.5 })
            .to(card, { scale: 1, ease: 'sine.inOut', duration: 0.5 });
          return tl;
        });

        return () => {
          batch.forEach((t) => t.kill());
          centres.forEach((tl) => {
            tl.scrollTrigger?.kill();
            tl.kill();
          });
          gsap.set(cards, { clearProps: 'all' });
        };
      });

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(cards, { y: 0, opacity: 1, scale: 1 });
      });

      return () => mm.revert();
    },
    { scope: ref, dependencies: [drinks.length] },
  );

  return (
    <div className="grid-drinks" ref={ref}>
      {drinks.map((d) => (
        <DrinkCard key={d.id} drink={d} />
      ))}
    </div>
  );
}
