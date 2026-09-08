'use client';
/**
 * The View Transitions driver (Blueprint §13.2).
 *
 * Next 16 has no `experimental.viewTransition` flag, so client navigation is
 * wrapped in `document.startViewTransition` here. Doing it explicitly buys two
 * things the flag would not have:
 *
 *   · the route variant is stamped on <html> BEFORE the old snapshot is taken,
 *     which is where the `::view-transition-*` pseudo-elements actually live —
 *     a `data-vt` on an inner div would never match them
 *   · the tapped element claims its `view-transition-name` in the same tick,
 *     so exactly ONE element is ever named (§13.6 rule 4)
 *
 * Layer 2 (no API support) and layer 3 (reduced motion) fall out of the CSS in
 * `transitions.css` — nothing breaks without support, it just gets simpler.
 */
import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, startTransition } from 'react';
import { directionFor, variantFor } from './routes';

type DocWithVT = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => {
    finished: Promise<void>;
    ready?: Promise<void>;
    updateCallbackDone?: Promise<void>;
  };
};

export function ViewTransitions({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const resolver = useRef<(() => void) | null>(null);
  const pending = useRef<string | null>(null);

  // Resolve the transition the instant React has committed the new route.
  //
  // Deliberately dependency-free rather than keyed on `pathname`: a navigation
  // that changes only the QUERY (/origins?focus=a → /origins?focus=b) never
  // changes pathname, so a pathname-keyed effect never fires and the morph sits
  // frozen until the 700ms bail-out below. Comparing the committed URL against
  // the one we asked for resolves on the right commit in both cases.
  useLayoutEffect(() => {
    if (!resolver.current) return;
    if (pending.current && window.location.pathname + window.location.search !== pending.current) return;
    resolver.current();
    resolver.current = null;
    pending.current = null;
  });

  const navigate = useCallback(
    (href: string) => {
      const doc = document as DocWithVT;
      const to = href.split('?')[0].split('#')[0];

      document.documentElement.dataset.vt = variantFor(to);
      document.documentElement.dataset.dir = directionFor(window.location.pathname, to);

      if (typeof doc.startViewTransition !== 'function') {
        startTransition(() => router.push(href));
        return;
      }

      pending.current = href.split('#')[0];

      const transition = doc.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            resolver.current = resolve;
            startTransition(() => router.push(href));
            // A route that suspends must never leave the page frozen mid-morph.
            window.setTimeout(() => {
              if (resolver.current) {
                resolver.current();
                resolver.current = null;
                pending.current = null;
              }
            }, 700);
          }),
      );

      const clear = () => {
        // Clear the name so the next navigation starts from a clean slate.
        document.querySelectorAll('[data-vt-active="true"]').forEach((el) => {
          el.removeAttribute('data-vt-active');
        });
      };
      // `finished` REJECTS when the browser skips the transition — a hidden
      // tab, a second navigation landing on top of this one. That is a normal
      // outcome, not an error, but an uncaught rejection would still surface
      // in the console as one.
      transition.finished.then(clear, clear);

      // `ready` and `updateCallbackDone` are separate promises the browser
      // creates and rejects on that same skip ("InvalidStateError: Transition
      // was aborted because of invalid state"). Nothing awaits them, so without
      // these no-op catches every interrupted navigation logs an uncaught
      // rejection — 127 of them in a 44-hop navigation stress run.
      transition.ready?.catch(() => {});
      transition.updateCallbackDone?.catch(() => {});
    },
    [router],
  );

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement | null)?.closest?.('a');
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download') || anchor.dataset.noVt !== undefined) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      // preventDefault ONLY — never stopPropagation. next/link runs the
      // component's own onClick first and then bails on `defaultPrevented`, so
      // preventing the default is enough to take over navigation while the
      // drawer-close and panel-close handlers on those links still fire.
      e.preventDefault();

      // The tapped card claims the shared name. Only ever one.
      document.querySelectorAll('[data-vt-active="true"]').forEach((el) => {
        el.removeAttribute('data-vt-active');
      });
      if (anchor.style.getPropertyValue('--vt-name')) {
        anchor.setAttribute('data-vt-active', 'true');
      }

      navigate(url.pathname + url.search + url.hash);
    };

    // Capture phase, so we run before next/link's own handler.
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [navigate]);

  // Browser back/forward gets the same choreography, reversed.
  useEffect(() => {
    const onPop = () => {
      document.documentElement.dataset.vt = variantFor(window.location.pathname);
      document.documentElement.dataset.dir = 'back';
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return <>{children}</>;
}
