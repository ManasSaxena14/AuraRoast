'use client';
/**
 * The page opening — every inner page's header arrives the same way.
 *
 * On each navigation (and the first load) the `.page-head` of the new page
 * plays one short GSAP timeline: the headline unmasks upward out of its own
 * baseline, then the breadcrumb, eyebrow and lede follow. Nothing is split
 * into spans — React owns that text and re-renders it (the tracker's
 * headline changes live), so the headline moves as one element under a
 * clip-path instead.
 *
 * Children that already animate themselves (`Reveal`, `SplitText`) are left
 * alone: they carry `data-reveal` or the `.split` class, or sit inside one.
 */
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { gsap, prefersReducedMotion } from './gsap';

const SELF_ANIMATED = '[data-reveal], .split';

export function PageIntro() {
  const pathname = usePathname();

  useEffect(() => {
    if (prefersReducedMotion()) return;
    // After the route has painted — the view transition snapshots first.
    let tl: gsap.core.Timeline | null = null;
    const raf = requestAnimationFrame(() => {
      const head = document.querySelector<HTMLElement>('main .page-head');
      if (!head) return;
      const free = (el: Element | null): el is HTMLElement =>
        !!el && !el.matches(SELF_ANIMATED) && !el.closest(SELF_ANIMATED);

      const h1 = head.querySelector('h1');
      const rest = Array.from(head.children).filter(
        (el) => el !== h1 && !el.contains(h1) && free(el),
      ) as HTMLElement[];

      tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
      if (free(h1)) {
        tl.fromTo(
          h1,
          { clipPath: 'inset(0 0 100% 0)', yPercent: 40, filter: 'blur(6px)' },
          { clipPath: 'inset(0 0 -20% 0)', yPercent: 0, filter: 'blur(0px)', duration: 1.1, clearProps: 'clipPath,filter,transform' },
        );
      }
      if (rest.length) {
        tl.fromTo(
          rest,
          { autoAlpha: 0, y: 18 },
          { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.07, clearProps: 'opacity,visibility,transform' },
          free(h1) ? '-=0.75' : 0,
        );
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      tl?.progress(1).kill(); // never leave a header half-revealed
    };
  }, [pathname]);

  return null;
}
