/** Route → transition family (Blueprint §13.4). Shared by the navigation
    interceptor and the <PageTransition> fallback wrapper. */
export const ROUTE_CLASS: [RegExp, string][] = [
  [/^\/menu\/[^/]+$/, 'vt-detail'], // continuity — shared element
  [/^\/guides\/[^/]+$/, 'vt-detail'], // continuity — shared element
  [/^\/checkout\/confirmation/, 'vt-ceremony'], // ceremony — the Halo close
  [/^\/track\//, 'vt-continue'], // continuity — Halo carried over
  [/^\/account/, 'vt-panel'], // hierarchy — slide up
  [/^\/login$/, 'vt-login'],
  [/^\/admin/, 'vt-instant'], // 120ms fade, deliberately plain
];

export function variantFor(pathname: string): string {
  return ROUTE_CLASS.find(([re]) => re.test(pathname))?.[1] ?? 'vt-default';
}

export function directionFor(from: string, to: string): 'forward' | 'back' | 'lateral' {
  const a = from.split('/').filter(Boolean).length;
  const b = to.split('/').filter(Boolean).length;
  return a === b ? 'lateral' : b > a ? 'forward' : 'back';
}

export const ROUTE_TITLES: [RegExp, string][] = [
  [/^\/$/, 'Home'],
  [/^\/menu$/, 'Menu'],
  [/^\/menu\//, 'Drink detail'],
  [/^\/origins/, 'Origins'],
  [/^\/guides$/, 'Brew guides'],
  [/^\/guides\//, 'Brew guide'],
  [/^\/stores/, 'Stores'],
  [/^\/reservations/, 'Reservations'],
  [/^\/checkout\/confirmation/, 'Order confirmed'],
  [/^\/checkout/, 'Checkout'],
  [/^\/track\//, 'Order tracking'],
  [/^\/account/, 'Account'],
  [/^\/login/, 'Sign in'],
  [/^\/admin/, 'Admin'],
];

export function titleFor(pathname: string): string {
  return ROUTE_TITLES.find(([re]) => re.test(pathname))?.[1] ?? 'Page';
}
