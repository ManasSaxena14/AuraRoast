'use client';
/**
 * "Perfect pairings" on a drink page. The plates tasted against THIS drink
 * lead, marked as such; the rest of the kitchen follows, so the guest can
 * still wander. Adding one drops it into the cart as a standalone line.
 */
import { useCart } from '@/components/cart/CartProvider';
import { toast } from '@/components/toast/ToastProvider';
import { PAIRINGS } from '@/data/pairings';
import { formatMoney } from '@/domain/money';
import { Reveal } from '@/components/motion/Reveal';
import type { Pairing } from '@/domain/types';
import Image from '@/components/ui/SmartImage';

export function PairingsSection({ drinkName, drinkSlug }: { drinkName: string; drinkSlug: string }) {
  const { addLine, open } = useCart();

  const handleAdd = (p: Pairing) => {
    addLine({ id: p.id, slug: p.slug, name: p.name, imageUrl: p.imageUrl, price: p.price }, 1);
    toast(`${p.name} added to the cart`, 'success');
    open();
  };

  const available = PAIRINGS.filter((p) => p.isAvailable);
  if (available.length === 0) return null;
  const matched = available.filter((p) => p.pairsWith.includes(drinkSlug));
  const ordered = [...matched, ...available.filter((p) => !matched.includes(p))];

  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="shell">
        <div className="pairings-head">
          <p className="eyebrow">Perfect pairings</p>
          <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
            {matched.length
              ? `${matched.length} plate${matched.length > 1 ? 's' : ''} tasted against the ${drinkName}`
              : `with ${drinkName}`}
          </span>
        </div>
        <Reveal variant="stagger" stagger={0.05} className="pairings-grid">
          {ordered.map((p) => {
            const best = matched.includes(p);
            return (
              <div key={p.id} className="drink-card pairing-card" data-best={best || undefined}>
                <div className="drink-card__media">
                  {best ? <span className="pairing-card__flag">Best match</span> : null}
                  <Image src={p.imageUrl} alt={p.name} width={400} height={300} sizes="(max-width: 639px) 90vw, 240px" />
                </div>
                <div className="drink-card__body">
                  <div className="row-between" style={{ alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                    <strong className="drink-card__title" style={{ fontSize: 'var(--text-base)' }}>
                      {p.name}
                    </strong>
                    <span className="drink-card__price" style={{ whiteSpace: 'nowrap' }}>
                      {formatMoney(p.price)}
                    </span>
                  </div>
                  <p className="muted" style={{ fontSize: 'var(--text-xs)', lineHeight: 1.45 }}>
                    {p.description}
                  </p>
                  <p className="muted" style={{ fontSize: 10, lineHeight: 1.4, fontStyle: 'italic' }}>
                    {p.pairingNote}
                  </p>
                  <button
                    className="btn btn--outline btn--sm"
                    style={{ marginTop: 'auto', width: '100%' }}
                    onClick={() => handleAdd(p)}
                  >
                    Add to order
                  </button>
                </div>
              </div>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
