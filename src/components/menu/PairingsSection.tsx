'use client';
/**
 * "Perfect pairings" section — a horizontal scroll of snack/dessert cards
 * that pair with the current drink. Each card has an "Add" button that
 * pushes the item into the cart as a standalone line (no modifiers).
 */
import { useCart } from '@/components/cart/CartProvider';
import { PAIRINGS } from '@/data/pairings';
import { formatMoney } from '@/domain/money';
import type { Pairing } from '@/domain/types';
import Image from 'next/image';

export function PairingsSection({ drinkName }: { drinkName: string }) {
  const { addLine, open } = useCart();

  const handleAdd = (p: Pairing) => {
    addLine({
      id: p.id,
      slug: p.slug,
      name: p.name,
      imageUrl: p.imageUrl,
      price: p.price,
    }, 1);
  };

  const available = PAIRINGS.filter((p) => p.isAvailable);

  if (available.length === 0) return null;

  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="shell">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
          <p className="eyebrow">Perfect pairings</p>
          <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>with {drinkName}</span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 'var(--space-4)',
        }}>
          {available.map((p) => (
            <div key={p.id} className="drink-card" style={{ cursor: 'default' }}>
              <div className="drink-card__media">
                <Image src={p.imageUrl} alt={p.name} width={400} height={300} sizes="(max-width: 639px) 90vw, 200px" />
              </div>
              <div className="drink-card__body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                  <strong className="drink-card__title" style={{ fontSize: 'var(--text-base)' }}>{p.name}</strong>
                  <span className="drink-card__price" style={{ whiteSpace: 'nowrap' }}>{formatMoney(p.price)}</span>
                </div>
                <p className="muted" style={{ fontSize: 'var(--text-xs)', lineHeight: 1.45 }}>{p.description}</p>
                <p className="muted" style={{ fontSize: 10, lineHeight: 1.4, fontStyle: 'italic' }}>{p.pairingNote}</p>
                <button
                  className="btn btn--outline btn--sm"
                  style={{ marginTop: 'auto', alignSelf: 'flex-start', width: '100%' }}
                  onClick={() => {
                    handleAdd(p);
                    open();
                  }}
                >
                  Add to order
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
