'use client';
/**
 * Motion System I — the page wrapper (Blueprint §13.3).
 *
 * Mounted ONCE in app/layout.tsx, wrapping {children}. The header, the AI
 * Barista launcher and the cart drawer live OUTSIDE it — they persist across
 * navigation and must never be part of the transition snapshot.
 *
 * `<ViewTransitions>` drives the actual morph. This component owns two things
 * that morph does not: the CSS-only fallback for browsers without the API, and
 * the three client-side-navigation accessibility requirements from §17.3 —
 * each of which is a silent failure if nobody implements it.
 */
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { directionFor, titleFor, variantFor } from './routes';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prev = useRef(pathname);
  const first = useRef(true);
  const [announcement, setAnnouncement] = useState('');

  const dir = directionFor(prev.current, pathname);
  const variant = variantFor(pathname);

  useEffect(() => {
    const changed = prev.current !== pathname;
    prev.current = pathname;
    if (first.current) {
      first.current = false;
      return;
    }
    if (!changed) return;

    // 1. The route change is announced — client-side navigation is silent to
    //    a screen reader unless you make it speak.
    setAnnouncement(`${titleFor(pathname)} — AURA TOAST`);

    // 2. Scroll position is restored BEFORE the transition paints (rule 5).
    try {
      window.scrollTo(0, 0);
      window.__lenis?.scrollTo(0, { immediate: true });
    } catch {
      /* a scroll library mid-teardown must never block the a11y work below */
    }

    // 3. Focus moves to the new page's <h1>, with no visible outline on a
    //    programmatic focus.
    //
    //    The <h1> is not necessarily in the DOM on the first frame after the
    //    route commits: a streamed Server Component can replace the subtree a
    //    beat later, taking the tabindex with it. So this retries briefly and
    //    stops the moment it succeeds.
    //
    // Timers, not requestAnimationFrame: rAF does not fire while a document is
    // hidden, and a background tab is exactly where a screen-reader user may
    // be sitting when the route changes.
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const claim = () => {
      const active = document.activeElement as HTMLElement | null;
      // Clicking a link leaves that link focused, and that is exactly the case
      // this exists for — so the only thing worth yielding to is a guest who
      // is typing.
      if (active?.closest('input, textarea, select, [contenteditable="true"]')) return;

      const h1 = document.querySelector<HTMLElement>('main h1');
      if (h1) {
        h1.setAttribute('tabindex', '-1');
        h1.focus({ preventScroll: true });
        if (document.activeElement === h1) return;
      }
      if (attempts++ < 20) timer = setTimeout(claim, 40);
    };

    claim();

    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
      <div data-vt={variant} data-dir={dir} className="page-root" key={pathname}>
        {children}
      </div>
    </>
  );
}
