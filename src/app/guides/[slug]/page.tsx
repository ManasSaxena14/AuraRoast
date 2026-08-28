import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getGuide, listGuides } from '@/repositories';
import { Reveal } from '@/components/motion/Reveal';
import { GuideRunner } from '@/components/guides/GuideRunner';

export async function generateStaticParams() {
  const guides = await listGuides();
  return guides.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuide(slug);
  return guide ? { title: guide.method, description: guide.summary } : { title: 'Not found' };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (!guide) notFound();

  return (
    <div className="shell shell--narrow">
      <header className="page-head">
        <p className="breadcrumb">
          <Link href="/guides">Guides</Link>
          <span aria-hidden="true">/</span>
          <span>{guide.method}</span>
        </p>
        <h1>{guide.method}</h1>
        <Reveal variant="rise" delay={0.05}>
          <p className="lede">{guide.summary}</p>
        </Reveal>
      </header>

      {/* The shared-element target of the morph from the guide card. */}
      <div
        className="guide-detail__hero drink-detail__hero"
        style={{ '--vt-name': `guide-${guide.slug}`, aspectRatio: '10 / 7' } as React.CSSProperties}
      >
        <Image src={guide.image} alt="" width={1000} height={700} priority sizes="(max-width: 1023px) 92vw, 900px" />
      </div>

      <Reveal variant="stagger" stagger={0.05} className="grid-4" >
        <div className="card">
          <p className="field__label">Ratio</p>
          <p className="mono">{guide.ratio}</p>
        </div>
        <div className="card">
          <p className="field__label">Grind</p>
          <p className="mono">{guide.grind}</p>
        </div>
        <div className="card">
          <p className="field__label">Yield</p>
          <p className="mono">{guide.yieldMl}ml</p>
        </div>
        <div className="card">
          <p className="field__label">Difficulty</p>
          <p className="mono">{guide.difficulty}</p>
        </div>
      </Reveal>

      <div style={{ height: 'var(--space-7)' }} />
      <GuideRunner guide={guide} />
      <div style={{ height: 'var(--space-10)' }} />
    </div>
  );
}
