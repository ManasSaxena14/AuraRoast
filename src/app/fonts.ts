import { Fraunces, IBM_Plex_Mono, Manrope } from 'next/font/google';

/**
 * Three roles, three faces (Blueprint §12.2). All loaded with `next/font` —
 * self-hosted, preloaded, `display: swap`, zero layout shift. A webfont that
 * swaps late is a CLS failure and a ScrollTrigger desync at the same time.
 *
 * Body uses Manrope, the fallback the blueprint names for General Sans, which
 * is Fontshare-hosted and cannot be self-hosted by `next/font/google`.
 */
export const display = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  axes: ['SOFT', 'WONK', 'opsz'],
});

export const body = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

export const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
  weight: ['400', '500'],
});

export const fontClass = `${display.variable} ${body.variable} ${mono.variable}`;
