'use client';
/**
 * The shared-element SOURCE for the `/menu → /menu/[id]` morph (§13.4).
 *
 * §13.6 rule 4: cap the number of `view-transition-name`s. The browser
 * snapshots every named element, so a grid of 30 simultaneously-named cards is
 * a jank source. The card only DECLARES its candidate name in `--vt-name`;
 * `<ViewTransitions>` promotes exactly the tapped one by setting
 * `data-vt-active` before the snapshot, and clears it when the morph finishes.
 */
import Image from 'next/image';
import Link from 'next/link';
import { formatMoneyShort } from '@/domain/money';
import { Badge } from './bits';
import type { Drink } from '@/domain/types';

export function DrinkCard({
  drink,
  priority = false,
}: {
  drink: Drink;
  priority?: boolean;
}) {
  return (
    <Link
      href={`/menu/${drink.slug}`}
      prefetch
      id={`card-${drink.slug}`}
      className="drink-card"
      data-soldout={!drink.isAvailable || undefined}
      style={{ '--vt-name': `drink-${drink.slug}` } as React.CSSProperties}
    >
      <div className="drink-card__media">
        {drink.isSeasonal ? (
          <span className="drink-card__flag badge badge--seasonal">Seasonal</span>
        ) : null}
        {!drink.isAvailable ? (
          <span className="drink-card__flag badge badge--muted">Sold out</span>
        ) : null}
        <Image
          src={drink.imageUrl}
          alt=""
          width={800}
          height={600}
          priority={priority}
          sizes="(max-width: 639px) 90vw, (max-width: 1023px) 45vw, 30vw"
        />
      </div>
      <div className="drink-card__body">
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <h3 className="drink-card__title">{drink.name}</h3>
          <span className="drink-card__price">{formatMoneyShort(drink.basePrice)}</span>
        </div>
        <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
          {drink.description}
        </p>
        <div className="drink-card__notes">
          {drink.tastingNotes.slice(0, 3).map((n) => (
            <span key={n} className="drink-card__note">
              {n}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

export function DrinkCardSkeleton() {
  return (
    <div className="drink-card" aria-hidden="true">
      <div className="drink-card__media skeleton" />
      <div className="drink-card__body">
        <div className="skeleton" style={{ height: 22, width: '60%' }} />
        <div className="skeleton" style={{ height: 14, width: '90%' }} />
        <div className="skeleton" style={{ height: 14, width: '40%' }} />
      </div>
    </div>
  );
}

export function DrinkBadges({ drink }: { drink: Drink }) {
  return (
    <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
      {drink.roast ? <Badge tone="aura">{drink.roast.replace('_', ' ')}</Badge> : null}
      {drink.isIced ? <Badge tone="muted">Iced</Badge> : null}
      {drink.allergens.length === 0 ? <Badge tone="origin">Dairy-free</Badge> : null}
      {drink.isSeasonal ? <Badge tone="seasonal">Seasonal</Badge> : null}
    </div>
  );
}
