import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
