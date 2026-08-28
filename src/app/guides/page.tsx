import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { listGuides } from '@/repositories';
import { Reveal } from '@/components/motion/Reveal';
import { Badge } from '@/components/ui/bits';

export const metadata: Metadata = {
  title: 'Brew guides',
  description: 'Five methods, each with a step timeline and a working timer.',
};

export default async function GuidesPage() {
  const guides = await listGuides();

  return (
    <div className="shell">
      <header className="page-head">
        <Reveal variant="fade">
          <p className="eyebrow">Do it at home</p>
        </Reveal>
        <h1>Five methods, honestly explained.</h1>
        <Reveal variant="rise" delay={0.06}>
          <p className="lede">
            Every step says what it is for. If a step exists only because it looks good, it is not
            in here.
          </p>
        </Reveal>
      </header>

      <Reveal variant="flip" stagger={0.07} className="grid-3" data-skew>
        {guides.map((g) => (
          <Link
            key={g.id}
            href={`/guides/${g.slug}`}
            prefetch
            className="guide-card"
            style={{ '--vt-name': `guide-${g.slug}` } as React.CSSProperties}
          >
            <div className="guide-card__media">
              <Image src={g.image} alt="" width={1000} height={700} sizes="(max-width: 639px) 90vw, 30vw" />
            </div>
            <div className="guide-card__body">
              <div className="row-between">
                <h2 style={{ fontSize: 'var(--text-lg)' }}>{g.method}</h2>
                <Badge tone={g.difficulty === 'exacting' ? 'seasonal' : 'muted'}>{g.difficulty}</Badge>
              </div>
              <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                {g.summary}
              </p>
              <p className="mono muted" style={{ fontSize: 11, marginTop: 'auto', paddingTop: 'var(--space-3)' }}>
                {g.ratio} · {g.steps.length} steps
              </p>
            </div>
          </Link>
        ))}
      </Reveal>
      <div style={{ height: 'var(--space-10)' }} />
    </div>
  );
}
