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
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { directionFor, titleFor, variantFor } from './routes';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prev = useRef(pathname);
  const scrolled = useRef(pathname);
  const first = useRef(true);
  const [announcement, setAnnouncement] = useState('');
  // Latches on the first client navigation and never unlatches — see the
  // `data-entry` comment on .page-root below. State, not a ref, because a
  // streamed subtree can re-render this component without a navigation and a
  // ref read during render would silently flip on that render instead.
  const [entry, setEntry] = useState<'cold' | 'client'>('cold');

  const dir = directionFor(prev.current, pathname);
  const variant = variantFor(pathname);

  // Commit-time work — both of these have to happen before the browser paints
  // the new route, so neither can sit in a passive effect. React defers those
  // for a transition update, which is exactly what a navigation is.
  useLayoutEffect(() => {
    // Initialised to the mount pathname, so this never fires on a cold load.
    if (scrolled.current === pathname) return;
    scrolled.current = pathname;
    setEntry('client'); // flushed before paint, so the fallback plays in full

    // 1. Scroll position is restored BEFORE the transition is photographed
    //    (rule 5). <ViewTransitions> resolves the update callback from its own
    //    layout effect and the browser snapshots the new page the moment that
    //    promise settles; this component is a DESCENDANT of it and child
    //    layout effects run first, so the reset lands before the shutter.
    try {
      window.scrollTo(0, 0);
      window.__lenis?.scrollTo(0, { immediate: true });
    } catch {
      /* a scroll library mid-teardown must never block the a11y work below */
    }

    // 2. The route change is announced — client-side navigation is silent to
    //    a screen reader unless you make it speak.
    //
    //    Cleared first, then set a beat later. A live region only speaks when
    //    its text CHANGES, so /menu/halo-espresso → /menu/long-black — two
    //    different pages that share the title "Drink detail" — would otherwise
    //    be announced exactly once, on the first of them.
    setAnnouncement('');
    const speak = setTimeout(() => setAnnouncement(`${titleFor(pathname)} — AURA TOAST`), 80);
    return () => clearTimeout(speak);
  }, [pathname]);

  useEffect(() => {
    const changed = prev.current !== pathname;
    prev.current = pathname;
    if (first.current) {
      first.current = false;
      return;
    }
    if (!changed) return;

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
    let landed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const claim = () => {
      const active = document.activeElement as HTMLElement | null;
      // Clicking a link leaves that link focused, and that is exactly the case
      // this exists for — so the only thing worth yielding to is a guest who
      // is typing.
      if (active?.closest('input, textarea, select, [contenteditable="true"]')) return;

      const h1 = document.querySelector<HTMLElement>('main h1');
      if (h1 && active === h1) {
        // A focus() that succeeded is not the same as focus that STUCK: on `/`
        // the hero is pinned, and ScrollTrigger re-parents it into the
        // injected .pin-spacer a beat after the route commits — which silently
        // blurs whatever inside it was focused, dropping the guest back on
        // <body>. So success is confirmed on a later pass, not claimed here.
        if (landed) return;
        landed = true;
      } else if (h1) {
        // Once it has landed, anything that is not the pin stealing focus back
        // to <body> is a guest who has moved on. Leave them where they are.
        if (landed && active !== document.body) return;
        h1.setAttribute('tabindex', '-1');
        h1.focus({ preventScroll: true });
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
      {/* `data-entry` is what keeps the layer-2 fallback off the cold load.
          On first paint .page-root holds the LCP headline, and fading the
          whole page up from zero would be animating it (rule 6) — so the CSS
          only matches once a client navigation has actually happened. */}
      <div
        data-vt={variant}
        data-dir={dir}
        data-entry={entry}
        className="page-root"
        key={pathname}
      >
        {children}
      </div>
    </>
  );
}
