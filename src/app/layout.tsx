import type { Metadata, Viewport } from 'next';
import { SITE } from '@/config/site';
import { fontClass } from './fonts';
import './globals.css';
import { AppProviders } from './providers';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { BackToTop } from '@/components/layout/BackToTop';
import { PageTransition } from '@/components/motion/PageTransition';
import { listDrinks, listModifiers } from '@/repositories';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s · ${SITE.name}` },
  description: SITE.description,
  openGraph: {
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: ['/img/og.webp'],
    type: 'website',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#120D0A',
  colorScheme: 'dark',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [drinks, modifiers] = await Promise.all([listDrinks(), listModifiers()]);

  return (
    <html lang="en-IN" className={fontClass}>
      <body>
        {/* Genuinely necessary here: the header plus a pinned hero is a lot to
            tab past (§17.3). First focusable element on every page. */}
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div className="grain" aria-hidden="true" />

        <AppProviders drinks={drinks} modifiers={modifiers}>
          {/* Header, cart drawer and Barista live OUTSIDE <PageTransition> —
              they persist across navigation and are never snapshotted (§13.3). */}
          <Header />
          <main id="main">
            <PageTransition>{children}</PageTransition>
          </main>
          <Footer />
          <BackToTop />
        </AppProviders>
      </body>
    </html>
  );
}
