import Link from 'next/link';
import type { Metadata } from 'next';
import { PHOTO_CREDITS } from '@/data/credits';
import { Reveal } from '@/components/motion/Reveal';

export const metadata: Metadata = {
  title: 'Photography credits',
  description: 'Every photograph on this site, its photographer, and its licence.',
};

/**
 * Most of these photographs are CC BY, which REQUIRES attribution. Putting the
 * list on the site rather than in a comment is the difference between meeting
 * the licence and intending to.
 */
export default function CreditsPage() {
  const licences = [...new Set(PHOTO_CREDITS.map((c) => c.license))].sort();

  return (
    <div className="shell shell--narrow">
      <header className="page-head">
        <Reveal variant="fade">
          <p className="eyebrow">Who took the pictures</p>
        </Reveal>
        <h1>Photography credits.</h1>
        <Reveal variant="rise" delay={0.06}>
          <p className="lede">
            Every photograph here came through the{' '}
            <a href="https://openverse.org" className="link-inline">
              Openverse
            </a>{' '}
            index, filtered to licences that permit commercial use <em>and</em> modification — each
            one is cropped and re-encoded for this site, so no-derivatives licences were excluded.
          </p>
        </Reveal>
        <Reveal variant="fade" delay={0.1}>
          <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
            {licences.map((l) => (
              <span key={l} className="chip chip--static">
                {l}
              </span>
            ))}
            <span className="chip chip--static">{PHOTO_CREDITS.length} photographs</span>
          </div>
        </Reveal>
      </header>

      <Reveal variant="stagger" stagger={0.02} className="credits">
        {PHOTO_CREDITS.map((c) => (
          <article key={c.slot} className="credit">
            <span className="credit__slot mono">{c.slot}</span>
            <div className="stack-sm" style={{ gap: 2 }}>
              <strong>{c.title}</strong>
              <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                {c.creatorUrl ? (
                  <a href={c.creatorUrl} rel="noopener noreferrer nofollow" target="_blank">
                    {c.creator}
                  </a>
                ) : (
                  c.creator
                )}
                {' · '}
                <a href={c.licenseUrl} rel="license noopener noreferrer" target="_blank">
                  {c.license}
                </a>
                {c.source ? (
                  <>
                    {' · '}
                    <a href={c.source} rel="noopener noreferrer nofollow" target="_blank">
                      {c.provider}
                    </a>
                  </>
                ) : null}
              </span>
            </div>
          </article>
        ))}
      </Reveal>

      <Reveal variant="fade">
        <p className="muted" style={{ fontSize: 'var(--text-sm)', marginBlock: 'var(--space-7)' }}>
          The 144-frame hero sequence is not from Openverse — it is rendered from this project&rsquo;s
          own footage. Map data © OpenStreetMap contributors, tiles by CARTO.{' '}
          <Link href="/" className="link-inline">
            Back to the start
          </Link>
        </p>
      </Reveal>
      <div style={{ height: 'var(--space-9)' }} />
    </div>
  );
}
