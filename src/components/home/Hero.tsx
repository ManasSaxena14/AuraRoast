'use client';
import Link from 'next/link';
import { HeroScrub } from '@/components/motion/HeroScrub';
import { SteamCanvas } from '@/components/motion/SteamCanvas';
import { scrollTo } from '@/components/motion/SmoothScroll';
import { HERO } from '@/data/content';

export function Hero() {
  return (
    <HeroScrub
      overlay={
        <>
          <SteamCanvas density={16} />
          <div className="hero__copy" data-hero-copy>
            <div className="hero__copy-inner">
              <div className="hero__stack">
                <p className="eyebrow">{HERO.eyebrow}</p>
                {/* The LCP element. It is NEVER animated — the content around
                    it reveals instead (§14.3, §16.2). */}
                <h1 className="hero__title">
                  {HERO.headlineLines[0]}
                  <br />
                  <em>{HERO.headlineLines[1]}</em>
                </h1>
                <p className="hero__sub">{HERO.sub}</p>
                {/* Keyboard-reachable BEFORE the scrub finishes. A pin must
                    never trap a keyboard user in a decorative sequence (§17.4). */}
                <div className="hero__ctas">
                  <Link href={HERO.primaryCta.href} className="btn btn--primary btn--lg" prefetch>
                    {HERO.primaryCta.label}
                  </Link>
                  <Link href={HERO.secondaryCta.href} className="btn btn--outline btn--lg" prefetch>
                    {HERO.secondaryCta.label}
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <button
            className="hero__scroll"
            onClick={() => scrollTo('#after-hero', -80)}
            aria-label="Skip the sequence and read on"
          >
            <span className="hero__scroll-line" aria-hidden="true" />
            {HERO.scrollHint}
          </button>
        </>
      }
    />
  );
}
