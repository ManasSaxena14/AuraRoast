import Link from 'next/link';
import { FOOTER_NAV } from '@/config/site';
import { FOOTER_NOTE } from '@/data/content';
import { CITIES, DEFAULT_STORE } from '@/data/stores';
import { Reveal } from '@/components/motion/Reveal';
import { Magnetic } from '@/components/motion/Magnetic';
import { Logo } from './Logo';
import { FooterLive } from './FooterLive';
import { FooterWordmark } from './FooterWordmark';

/**
 * The footer, in three registers: an invitation (the CTA band), the index
 * (brand, live status, every link, the cities), and the signature (the
 * wordmark and the small print). Quiet type, generous space, one moving
 * thing — the wordmark — which is how a house brand signs off.
 */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="footer__aura" aria-hidden="true" />

      <div className="shell">
        {/* ── Invitation ──────────────────────────────────────────── */}
        <Reveal variant="rise" className="footer-cta">
          <div className="stack-sm">
            <p className="eyebrow" style={{ marginBottom: 0 }}>
              Open today across six cities
            </p>
            <h2 className="footer-cta__title">
              Your next cup is
              <br />
              <em>twelve minutes</em> away.
            </h2>
          </div>
          <div className="footer-cta__actions">
            <Magnetic>
              <Link href="/menu" className="btn btn--primary btn--lg">
                Order now
              </Link>
            </Magnetic>
            <Link href="/reservations" className="btn btn--outline btn--lg">
              Reserve a table
            </Link>
          </div>
        </Reveal>

        {/* ── Index ───────────────────────────────────────────────── */}
        <div className="footer__grid">
          <Reveal variant="rise" className="footer__brand">
            <Logo size={48} tagline />
            <p className="muted footer__about">
              Roasted in Koramangala every Tuesday and Friday, on a truck to all twelve rooms the
              same week. Every bag carries a roast date, never a best-before.
            </p>
            <FooterLive />
            <dl className="footer__contact">
              <div>
                <dt>Flagship</dt>
                <dd>{DEFAULT_STORE.address}</dd>
              </div>
              <div>
                <dt>Roastery</dt>
                <dd>Koramangala, Bengaluru · roasting Tuesday &amp; Friday</dd>
              </div>
            </dl>
          </Reveal>

          <Reveal variant="stagger" stagger={0.06} className="footer__cols">
            {FOOTER_NAV.map((col) => (
              <nav key={col.title} className="footer__col" aria-label={col.title}>
                <p className="footer__heading">{col.title}</p>
                <ul>
                  {col.links.map((l) => (
                    <li key={l.href + l.label}>
                      <Link href={l.href} className="footer__link">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
            <nav className="footer__col" aria-label="Cities">
              <p className="footer__heading">Cities</p>
              <ul>
                {CITIES.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/stores?city=${c.slug}`} className="footer__link">
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </Reveal>
        </div>
      </div>

      {/* ── Signature ─────────────────────────────────────────────── */}
      <FooterWordmark />

      <div className="shell">
        <div className="footer__bottom">
          <p className="mono">© {year} Aura Toast Coffee · Atmospheric craft, pure origin</p>
          <ul className="footer__legal">
            <li>
              <span className="footer__pay">Cash · UPI · No card data stored</span>
            </li>
            <li>
              <Link href="/credits" className="footer__link">
                Credits
              </Link>
            </li>
            <li>
              <Link href="/admin" className="footer__link">
                Staff
              </Link>
            </li>
          </ul>
        </div>
        <p className="footer__attribution">{FOOTER_NOTE}</p>
      </div>
    </footer>
  );
}
