'use client';
/**
 * Client cart state (Blueprint Part 11).
 *
 * The cart computes its totals CLIENT-SIDE for instant feel, using the exact
 * same pure `priceCart` the server uses for truth (§9.1). The client number is
 * never authoritative — checkout re-prices against the server before it will
 * show a total, and the server re-prices again before anything is written.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { priceCart, findPromo, buildModifierIndex } from '@/domain/pricing';
import type { CartLine, Drink, Modifier, PricedCart, SelectedModifier } from '@/domain/types';

const STORAGE_KEY = 'aura-toast.cart.v3';

interface CartContextValue {
  lines: CartLine[];
  priced: PricedCart;
  fulfillment: 'delivery' | 'pickup';
  promoCode: string | null;
  tip: number;
  count: number;
  isOpen: boolean;
  hydrated: boolean;
  add: (drink: Drink, modifiers: SelectedModifier[], quantity?: number) => void;
  addLine: (line: { id: string; slug: string; name: string; imageUrl: string; price: number }, quantity?: number) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  remove: (lineId: string) => void;
  clear: () => void;
  setFulfillment: (f: 'delivery' | 'pickup') => void;
  setPromoCode: (c: string | null) => void;
  setTip: (t: number) => void;
  open: () => void;
  close: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function lineKey(drinkId: string, modifiers: SelectedModifier[]): string {
  return `${drinkId}::${modifiers.map((m) => `${m.kind}:${m.slug}`).sort().join('|')}`;
}

export function CartProvider({
  catalogue,
  modifiers,
  children,
}: {
  catalogue: Drink[];
  /* Passed so the optimistic client total is computed from the SAME stored
     deltas the server re-prices against, instead of the ones cached in the
     line. Without it a stale localStorage cart previews a stale price. */
  modifiers: Modifier[];
  children: ReactNode;
}) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [fulfillment, setFulfillment] = useState<'delivery' | 'pickup'>('delivery');
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [tip, setTip] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          lines?: CartLine[];
          fulfillment?: 'delivery' | 'pickup';
          promoCode?: string | null;
          tip?: number;
        };
        if (parsed.lines) setLines(parsed.lines);
        if (parsed.fulfillment) setFulfillment(parsed.fulfillment);
        if (parsed.promoCode !== undefined) setPromoCode(parsed.promoCode);
        if (typeof parsed.tip === 'number') setTip(parsed.tip);
      }
    } catch {
      /* a corrupt cart is not worth a crash */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lines, fulfillment, promoCode, tip }));
    } catch {
      /* private mode / quota — the cart still works for this session */
    }
  }, [lines, fulfillment, promoCode, tip, hydrated]);

  const catalogueMap = useMemo(() => new Map(catalogue.map((d) => [d.id, d])), [catalogue]);
  const modifierIndex = useMemo(() => buildModifierIndex(modifiers), [modifiers]);

  const priced = useMemo(
    () =>
      priceCart({
        lines,
        catalogue: catalogueMap,
        modifiers: modifierIndex,
        fulfillment,
        tip,
        promo: findPromo(promoCode),
      }),
    [lines, catalogueMap, modifierIndex, fulfillment, tip, promoCode],
  );

  const add = useCallback((drink: Drink, modifiers: SelectedModifier[], quantity = 1) => {
    const key = lineKey(drink.id, modifiers);
    setLines((prev) => {
      const existing = prev.find((l) => l.lineId === key);
      if (existing) {
        return prev.map((l) =>
          l.lineId === key ? { ...l, quantity: Math.min(20, l.quantity + quantity) } : l,
        );
      }
      return [
        ...prev,
        {
          lineId: key,
          drinkId: drink.id,
          slug: drink.slug,
          name: drink.name,
          imageUrl: drink.imageUrl,
          quantity,
          modifiers,
        },
      ];
    });
  }, []);

  /** Add a standalone item (e.g. a pairing) without constructing a full Drink. */
  const addLine = useCallback((line: { id: string; slug: string; name: string; imageUrl: string; price: number }, quantity = 1) => {
    const key = `pairing-${line.id}`;
    setLines((prev) => {
      const existing = prev.find((l) => l.lineId === key);
      if (existing) {
        return prev.map((l) =>
          l.lineId === key ? { ...l, quantity: Math.min(20, l.quantity + quantity) } : l,
        );
      }
      return [
        ...prev,
        {
          lineId: key,
          drinkId: line.id,
          slug: line.slug,
          name: line.name,
          imageUrl: line.imageUrl,
          quantity,
          modifiers: [],
        },
      ];
    });
  }, []);

  const setQuantity = useCallback((lineId: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.lineId !== lineId)
        : prev.map((l) => (l.lineId === lineId ? { ...l, quantity: Math.min(20, quantity) } : l)),
    );
  }, []);

  const remove = useCallback((lineId: string) => {
    setLines((prev) => prev.filter((l) => l.lineId !== lineId));
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    setPromoCode(null);
    setTip(0);
  }, []);

  const value: CartContextValue = {
    lines,
    priced,
    fulfillment,
    promoCode,
    tip,
    count: lines.reduce((a, l) => a + l.quantity, 0),
    isOpen,
    hydrated,
    add,
    addLine,
    setQuantity,
    remove,
    clear,
    setFulfillment,
    setPromoCode,
    setTip,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
