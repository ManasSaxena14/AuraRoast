'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { HeroScrub } from '@/components/motion/HeroScrub';
import { SteamCanvas } from '@/components/motion/SteamCanvas';
import { scrollTo } from '@/components/motion/SmoothScroll';
import { HERO } from '@/data/content';

export function Hero() {
  const [brandRevealed, setBrandRevealed] = useState(false);
  const [brandSeen, setBrandSeen] = useState(false);

  /* One-time brand reveal on fresh sessions. Gated by sessionStorage so
     revisiting the page within the same tab does not replay it. */
  useEffect(() => {
    try {
      if (sessionStorage.getItem('aura.brand') === '1') {
        setBrandRevealed(true);
        setBrandSeen(true);
        return;
      }
    } catch { /* unavailable */ }

    // Both timers are tracked here: a cleanup returned from inside a setTimeout
    // callback is never called by anything, so the second one used to outlive
    // the component and setState on an unmounted tree.
    let end: ReturnType<typeof setTimeout> | undefined;
    const t = setTimeout(() => {
      setBrandRevealed(true);
      try {
        sessionStorage.setItem('aura.brand', '1');
      } catch {
        /* private mode — replaying the gate is better than throwing here */
      }
      end = setTimeout(() => setBrandSeen(true), 900);
    }, 200);

    return () => {
      clearTimeout(t);
      clearTimeout(end);
    };
  }, []);

  return (
    <>
      {/* Brand reveal gate — first load only, ~800ms.
          Kept mounted and toggled by attribute. Mounting it conditionally makes
          React insert a sibling immediately before the pinned hero, which GSAP
          has already moved into a pin-spacer — the NotFoundError crash that took
          the whole homepage down. See HeroScrub.tsx. */}
      <div className="brand-gate" data-active={brandRevealed && !brandSeen ? 'true' : undefined} aria-hidden="true">
        <div className="brand-gate__inner">
          <svg viewBox="0 0 120 120" width="80" height="80" className="brand-gate__logo">
            {/* Cup arc */}
            <circle cx="60" cy="60" r="42" fill="none" stroke="var(--aura-500)" strokeWidth="2.5"
              strokeDasharray="264" strokeDashoffset="264"
              className="brand-gate__arc"
              style={{ transformOrigin: '60px 60px' }}
            />
            {/* Steam */}
            <path d="M52 36c0-8 4-14 8-14s8 6 8 14" fill="none" stroke="var(--aura-300)" strokeWidth="1.8"
              strokeLinecap="round"
              strokeDasharray="30" strokeDashoffset="30"
              className="brand-gate__steam"
              style={{ transformOrigin: '60px 36px' }}
            />
            <path d="M68 32c0-6 3-10 6-10s6 4 6 10" fill="none" stroke="var(--aura-300)" strokeWidth="1.8"
              strokeLinecap="round"
              strokeDasharray="24" strokeDashoffset="24"
              className="brand-gate__steam brand-gate__steam--delayed"
              style={{ transformOrigin: '72px 32px' }}
            />
          </svg>
          <p className="brand-gate__wordmark">AURA TOAST</p>
        </div>
      </div>

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
    </>
  );
}
