'use client';
/**
 * Lenis (Blueprint §14.2).
 *
 * Three non-negotiable rules, all enforced here:
 *   · `syncTouch: false` — overriding native touch momentum makes a phone feel
 *     broken in a way users notice and cannot articulate
 *   · Lenis is OFF under reduced motion, not slowed down
 *   · any overlay that locks the body dispatches `ui:lock-scroll`, because
 *     `overflow: hidden` alone does not stop Lenis
 *
 * Both libraries are imported dynamically inside the effect. Neither is needed
 * to RENDER the page, only to move it, so neither belongs in the critical path
 * — and this keeps GSAP out of the shared layout chunk entirely (§16.2).
 */
import { useEffect } from 'react';
import type Lenis from 'lenis';

declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

type LenisCtor = typeof import('lenis').default;
type Gsap = typeof import('gsap').gsap;
type ScrollTriggerType = typeof import('gsap/ScrollTrigger').ScrollTrigger;

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Reduced motion gets native scroll. No exceptions, no degraded version.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.dataset.smooth = 'off';
      return;
    }

    let teardown: (() => void) | null = null;
    let cancelled = false;

    void (async () => {
      const [{ default: LenisCtor }, { gsap, ScrollTrigger }] = await Promise.all([
        import('lenis'),
        import('./gsap'),
      ]);
      if (cancelled) return;
      teardown = attach(LenisCtor, gsap, ScrollTrigger);
    })();

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, []);

  return <>{children}</>;
}

function attach(LenisCtor: LenisCtor, gsap: Gsap, ScrollTrigger: ScrollTriggerType): () => void {
  const lenis = new LenisCtor({
    duration: 1.05,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    syncTouch: false, // native momentum on touch — Lenis on mobile fights the OS
  });
  window.__lenis = lenis;
  document.documentElement.dataset.smooth = 'on';

  // THE critical wiring. Without these two lines ScrollTrigger reads stale
  // scroll positions and every pinned section drifts. This is the single most
  // common Lenis + GSAP bug.
  const onScroll = () => ScrollTrigger.update();
  lenis.on('scroll', onScroll);

  const tick = (time: number) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  // Any overlay that locks the body must stop Lenis, not just set overflow.
  const halt = () => lenis.stop();
  const resume = () => lenis.start();
  window.addEventListener('ui:lock-scroll', halt);
  window.addEventListener('ui:unlock-scroll', resume);

  // Triggers computed against pre-font-load heights are wrong by 20–200px
  // (§14.7 rule 2).
  void document.fonts?.ready.then(() => {
    ScrollTrigger.refresh();
    reanchorHash(lenis);
  });

  // A pin inserts a spacer as tall as its scrub, which moves every section
  // below it. A `/#section` deep link resolved by the browser BEFORE that
  // happens therefore lands in the middle of the pinned hero. Re-anchoring
  // after the first refresh puts the guest where they actually asked to be.
  // `refresh`, not `refreshInit` — the positions are only correct once the
  // recalculation has finished and the pin spacers exist.
  const onRefresh = () => reanchorHash(lenis);
  ScrollTrigger.addEventListener('refresh', onRefresh);
  const settle = setTimeout(onRefresh, 800);

  return () => {
    window.removeEventListener('ui:lock-scroll', halt);
    window.removeEventListener('ui:unlock-scroll', resume);
    clearTimeout(settle);
    ScrollTrigger.removeEventListener('refresh', onRefresh);
    lenis.off('scroll', onScroll);
    gsap.ticker.remove(tick);
    lenis.destroy();
    delete window.__lenis;
  };
}

let hashSettled = false;

function reanchorHash(lenis: Lenis): void {
  if (hashSettled) return;
  const hash = window.location.hash;
  if (!hash || hash.length < 2) {
    hashSettled = true;
    return;
  }
  const target = document.querySelector<HTMLElement>(hash);
  if (!target) return;
  hashSettled = true;
  lenis.scrollTo(target, { offset: -80, immediate: true });
}

/** The one way anything in the app scrolls programmatically. */
export function scrollTo(target: string | number | HTMLElement, offset = 0) {
  if (typeof window === 'undefined') return;
  const lenis = window.__lenis;
  if (lenis) {
    lenis.scrollTo(target, { offset, duration: 1.1 });
    return;
  }
  if (typeof target === 'number') {
    window.scrollTo({ top: target + offset, behavior: 'smooth' });
    return;
  }
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (el instanceof HTMLElement) {
    window.scrollTo({ top: el.offsetTop + offset, behavior: 'smooth' });
  }
}

export function lockScroll() {
  window.dispatchEvent(new Event('ui:lock-scroll'));
  document.documentElement.style.overflow = 'hidden';
}

export function unlockScroll() {
  window.dispatchEvent(new Event('ui:unlock-scroll'));
  document.documentElement.style.overflow = '';
}
