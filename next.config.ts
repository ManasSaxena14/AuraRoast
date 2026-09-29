import type { NextConfig } from 'next';

/**
 * Sent on every response. Deliberately conservative: nothing here can break a
 * page (no CSP to drift out of sync with GSAP, Leaflet tiles and the OAuth
 * redirect), and each line closes a real hole.
 */
const SECURITY_HEADERS = [
  // Stops a browser guessing a JSON or text response is HTML and running it.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Nobody can frame the checkout and trick a tap onto "Place order".
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Order numbers live in URLs; other sites only ever see our origin.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Geolocation stays available to our own checkout ("nearest bar"); the
  // sensors we never use are off for everything, embeds included.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), payment=(), usb=(), geolocation=(self)' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // No `X-Powered-By: Next.js` — there is no reason to advertise the stack.
  poweredByHeader: false,
  // A stray lockfile higher up the disk made Next guess the wrong workspace
  // root; this project is its own root.
  turbopack: { root: process.cwd() },
  experimental: {
    optimizePackageImports: ['gsap', 'lenis'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      {
        // The hero frames live at fixed names (001.webp…) under public/, so they
        // are NOT content-addressed — `immutable` would strand a re-render in
        // every cache for a year with no busting lever. Revalidate instead.
        source: '/hero/:path*',
        headers: [{
          key: 'Cache-Control',
          value: 'public, max-age=3600, stale-while-revalidate=86400, must-revalidate',
        }],
      },
    ];
  },
};

export default nextConfig;
