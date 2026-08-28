'use client';
/**
 * The header lives OUTSIDE <PageTransition> — it persists across navigation
 * and must never be part of the transition snapshot (§13.3).
 *
 * Global behaviours (§14.6): sticky fade past 80px, where the backdrop blur
 * and the --roast-900/80 background appear together, plus the scroll-progress
 * Halo which is driven by CSS scroll timeline, not JS.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NAV } from '@/config/site';
import { ScrollProgress } from '@/components/motion/ScrollProgress';
import { useCart } from '@/components/cart/CartProvider';
import { Logo } from './Logo';

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const { count, open } = useCart();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <header className="header" data-scrolled={scrolled || undefined}>
      <div className="header__inner">
        <Link href="/" className="header__brand" aria-label="AURA TOAST — home">
          <Logo size={30} tagline />
        </Link>

        <nav className="header__nav" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              className="header__link"
              aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="header__actions">
          <ScrollProgress />
          <Link href="/account" className="btn btn--ghost btn--sm header__account">
            Account
          </Link>
          <button className="cart-button" onClick={open} aria-label={`Open cart, ${count} items`}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M4 7h16l-1.4 11.2a2 2 0 0 1-2 1.8H7.4a2 2 0 0 1-2-1.8L4 7Zm4 0V5.5a4 4 0 0 1 8 0V7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            {/* The cup fills as items are added — the one place the overshoot
                curve is unambiguously correct (Part 15). */}
            <span className="cart-button__fill" style={{ transform: `scaleY(${Math.min(1, count / 6)})` }} />
            {count > 0 ? <span className="cart-button__count mono">{count}</span> : null}
          </button>
          <button
            className="header__burger"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label="Menu"
          >
            <span data-open={menuOpen || undefined} />
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav className="header__mobile" aria-label="Primary mobile">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="header__mobile-link">
              {item.label}
            </Link>
          ))}
          <Link href="/account" className="header__mobile-link">
            Account
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
