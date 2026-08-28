import Link from 'next/link';
import { FOOTER_NAV } from '@/config/site';
import { FOOTER_NOTE } from '@/data/content';
import { Reveal } from '@/components/motion/Reveal';
import { Logo } from './Logo';

export function Footer() {
  return (
    <footer className="footer">
      <div className="shell">
        <Reveal variant="rise" className="footer__top">
          <div className="footer__brand">
            <Logo size={64} layout="stacked" tagline animate />
            <p className="muted" style={{ maxWidth: '34ch', marginTop: 'var(--space-3)' }}>
              Roasted in Koramangala, Tuesday and Friday, and on a truck to all twelve rooms the
              same week. Bags carry a roast date, not a best-before.
            </p>
          </div>

          <div className="footer__cols">
            {FOOTER_NAV.map((col) => (
              <div key={col.title} className="stack-sm">
                <p className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>
                  {col.title}
                </p>
                <ul className="stack-sm">
                  {col.links.map((l) => (
                    <li key={l.href + l.label}>
                      <Link href={l.href} className="footer__link">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Reveal>

        <hr className="rule" />

        <div className="footer__bottom">
          <p className="mono muted">© {new Date().getFullYear()} Aura Toast Coffee</p>
          <p className="muted footer__attribution">{FOOTER_NOTE}</p>
        </div>
      </div>
    </footer>
  );
}
