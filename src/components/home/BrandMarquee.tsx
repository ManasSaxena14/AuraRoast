'use client';
import { Marquee } from '@/components/motion/Marquee';

const WORDS = ['Single origin', 'Roasted Tuesday', 'Named farms', 'Roast date, not best-before'];

/** Two bands running against each other — the counter-motion is what makes
    scroll direction legible at a glance. */
export function BrandMarquee() {
  return (
    <div className="brand-marquee">
      <Marquee speed={40}>
        {WORDS.map((w) => (
          <span className="marquee__item" key={w}>
            {w}
            <i className="marquee__dot" />
          </span>
        ))}
      </Marquee>
      <Marquee speed={28} reverse>
        {WORDS.map((w) => (
          <span className="marquee__item" data-ghost key={`g-${w}`}>
            {w}
            <i className="marquee__dot" />
          </span>
        ))}
      </Marquee>
    </div>
  );
}
