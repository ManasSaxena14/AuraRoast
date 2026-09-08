/** Route → transition family (Blueprint §13.4). Shared by the navigation
    interceptor and the <PageTransition> fallback wrapper.

    First match wins, so the specific patterns sit above the general ones —
    `/checkout/confirmation` before `/checkout`, `/menu/[id]` before `/menu`.
    Every variant is defined in `styles/transitions.css` as a short block of
    custom properties over one shared choreography. */
export const ROUTE_CLASS: [RegExp, string][] = [
  [/^\/menu\/[^/]+$/, 'vt-detail'], // continuity — shared element
  [/^\/guides\/[^/]+$/, 'vt-detail'], // continuity — shared element
  [/^\/checkout\/confirmation/, 'vt-ceremony'], // ceremony — the Halo close
  [/^\/checkout/, 'vt-focus'], // hierarchy — the funnel narrows
  [/^\/reservations/, 'vt-focus'], // hierarchy — same funnel, same beat
  [/^\/track\//, 'vt-continue'], // continuity — Halo carried over
  [/^\/account/, 'vt-panel'], // hierarchy — slide up
  [/^\/login$/, 'vt-login'],
  [/^\/admin/, 'vt-instant'], // 120ms fade, deliberately plain
  [/^\/credits/, 'vt-quiet'], // a colophon that swept in would be showing off
  [/^\/menu$/, 'vt-index'], // browse — short travel, quick hand-off
  [/^\/guides$/, 'vt-index'],
  [/^\/about/, 'vt-editorial'], // long-form — the chapter turn
  [/^\/origins/, 'vt-editorial'],
  [/^\/pairings/, 'vt-editorial'],
  [/^\/locations/, 'vt-place'], // arriving somewhere
  [/^\/stores/, 'vt-place'],
  [/^\/$/, 'vt-home'], // the anchor — pure depth, widest bloom
];

export function variantFor(pathname: string): string {
  return ROUTE_CLASS.find(([re]) => re.test(pathname))?.[1] ?? 'vt-default';
}

export function directionFor(from: string, to: string): 'forward' | 'back' | 'lateral' {
  const a = from.split('/').filter(Boolean).length;
  const b = to.split('/').filter(Boolean).length;
  return a === b ? 'lateral' : b > a ? 'forward' : 'back';
}

/** Read aloud on every client-side navigation (§17.3), so a route with no
    entry here announces itself as "Page". Every route in `src/app` is covered. */
export const ROUTE_TITLES: [RegExp, string][] = [
  [/^\/$/, 'Home'],
  [/^\/menu$/, 'Menu'],
  [/^\/menu\//, 'Drink detail'],
  [/^\/pairings/, 'Pairings'],
  [/^\/about/, 'About'],
  [/^\/origins/, 'Origins'],
  [/^\/guides$/, 'Brew guides'],
  [/^\/guides\//, 'Brew guide'],
  [/^\/locations/, 'Locations'],
  [/^\/stores/, 'Stores'],
  [/^\/reservations/, 'Reservations'],
  [/^\/checkout\/confirmation/, 'Order confirmed'],
  [/^\/checkout/, 'Checkout'],
  [/^\/track\//, 'Order tracking'],
  [/^\/track$/, 'Track an order'],
  [/^\/account/, 'Account'],
  [/^\/login/, 'Sign in'],
  [/^\/admin/, 'Admin'],
  [/^\/credits/, 'Photo credits'],
];

export function titleFor(pathname: string): string {
  return ROUTE_TITLES.find(([re]) => re.test(pathname))?.[1] ?? 'Page';
}
