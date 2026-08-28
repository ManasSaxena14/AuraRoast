import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getDrinkPage } from '@/services/catalog';
import { listDrinks } from '@/repositories';
import { formatMoney } from '@/domain/money';
import { Reveal } from '@/components/motion/Reveal';
import { Parallax } from '@/components/motion/Parallax';
import { BrewBuilder } from '@/components/menu/BrewBuilder';
import { DrinkBadges } from '@/components/ui/DrinkCard';
import { Rating, SectionHead } from '@/components/ui/bits';
import { ReviewList } from '@/components/menu/ReviewList';
import { OriginMini } from '@/components/menu/OriginMini';

export async function generateStaticParams() {
  const drinks = await listDrinks();
  return drinks.map((d) => ({ drinkId: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ drinkId: string }>;
}): Promise<Metadata> {
  const { drinkId } = await params;
  const data = await getDrinkPage(drinkId);
  if (!data) return { title: 'Not found' };
  return {
    title: data.drink.name,
    description: data.drink.description,
    openGraph: { images: [data.drink.imageUrl] },
  };
}

export default async function DrinkPage({ params }: { params: Promise<{ drinkId: string }> }) {
  const { drinkId } = await params;
  const data = await getDrinkPage(drinkId);
  if (!data) notFound();

  const { drink, modifiers, defaults, reviews, rating, origin } = data;

  return (
    <div className="shell">
      <div className="detail">
        {/* Pinned on desktop for the length of the builder, with parallax on
            the image inside it (§14.6). */}
        <div className="detail__media">
          <p className="breadcrumb" style={{ marginBottom: 'var(--space-4)' }}>
            <Link href="/menu">Menu</Link>
            <span aria-hidden="true">/</span>
            <span>{drink.category}</span>
          </p>

          {/* The shared-element TARGET of the morph from the menu grid. */}
          <div
            className="drink-detail__hero"
            style={{ '--vt-name': `drink-${drink.slug}` } as React.CSSProperties}
          >
            <Parallax amount={0.08}>
              <Image
                src={drink.imageUrl}
                alt={drink.name}
                width={800}
                height={600}
                priority
                sizes="(max-width: 1023px) 92vw, 46vw"
              />
            </Parallax>
          </div>

          <Reveal variant="rise" delay={0.05} className="stack-sm" >
            <div style={{ marginTop: 'var(--space-5)' }}>
              <DrinkBadges drink={drink} />
            </div>
            <p className="muted" style={{ marginTop: 'var(--space-4)' }}>
              {drink.longDescription}
            </p>
          </Reveal>

          {origin ? <OriginMini origin={origin} /> : null}
        </div>

        <div>
          <header className="stack-sm" style={{ marginBottom: 'var(--space-6)' }}>
            <p className="eyebrow">{origin ? origin.name : 'House recipe'}</p>
            <h1>{drink.name}</h1>
            <p className="lede">{drink.description}</p>
            <div className="row wrap" style={{ gap: 'var(--space-5)' }}>
              <span className="mono" style={{ color: 'var(--aura-500)', fontSize: 'var(--text-lg)' }}>
                {formatMoney(drink.basePrice)}
              </span>
              {rating.count > 0 ? <Rating value={rating.average} count={rating.count} /> : null}
            </div>
          </header>

          <BrewBuilder drink={drink} modifiers={modifiers} defaults={defaults} />
        </div>
      </div>

      <section className="section">
        <SectionHead
          eyebrow="What people say"
          title={rating.count > 0 ? `${rating.count} reviews` : 'No reviews yet'}
        />
        <ReviewList drinkId={drink.id} initial={reviews} />
      </section>
    </div>
  );
}
