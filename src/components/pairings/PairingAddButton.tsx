'use client';
import { useCart } from '@/components/cart/CartProvider';
import { toast } from '@/components/toast/ToastProvider';
import type { Pairing } from '@/domain/types';

export function PairingAddButton({
  pairing,
  className = 'btn btn--outline btn--sm',
}: {
  pairing: Pairing;
  className?: string;
}) {
  const { addLine, open } = useCart();

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addLine(
      {
        id: pairing.id,
        slug: pairing.slug,
        name: pairing.name,
        imageUrl: pairing.imageUrl,
        price: pairing.price,
      },
      1,
    );
    toast(`${pairing.name} added to order`, 'success');
    open();
  };

  return (
    <button type="button" className={className} onClick={handleAdd} aria-label={`Add ${pairing.name} to order`}>
      <span>+ Add to order</span>
    </button>
  );
}
