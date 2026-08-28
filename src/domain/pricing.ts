/**
 * Server-owned pricing (Blueprint §9.1).
 *
 * The client runs this same pure function for instant feel; the server runs it
 * again against the stored catalogue before anything is persisted. The client's
 * number is read for comparison and then discarded — it is never written.
 */
import { pct, sum, type Paise } from './money';
import type { CartLine, Drink, Modifier, PricedCart, PricedLine } from './types';

export const TAX_PERCENT = 5; // GST on prepared beverages
export const DELIVERY_FEE: Paise = 4900;
export const FREE_DELIVERY_THRESHOLD: Paise = 79900;
export const PICKUP_FEE: Paise = 0;

export interface PromoCode {
  code: string;
  kind: 'percent' | 'flat';
  value: number;
  minSubtotal: Paise;
  label: string;
}

export const PROMOS: readonly PromoCode[] = [
  { code: 'FIRSTPOUR', kind: 'percent', value: 15, minSubtotal: 0, label: '15% off your first pour' },
  { code: 'HALO200', kind: 'flat', value: 20000, minSubtotal: 90000, label: '₹200 off over ₹900' },
  { code: 'ORIGIN10', kind: 'percent', value: 10, minSubtotal: 40000, label: '10% off over ₹400' },
] as const;

export function findPromo(code: string | null | undefined): PromoCode | null {
  if (!code) return null;
  return PROMOS.find((p) => p.code === code.trim().toUpperCase()) ?? null;
}

/** Unit price for one configured drink. Pure. */
export function priceLine(drink: Drink, line: CartLine): PricedLine {
  const modifierDelta = sum(line.modifiers.map((m) => m.priceDelta));
  const unitPrice = Math.max(0, drink.basePrice + modifierDelta);
  const caffeinePerUnit = Math.max(
    0,
    drink.caffeineMg + line.modifiers.reduce((a, m) => a + m.caffeineDelta, 0),
  );
  return {
    lineId: line.lineId,
    drinkId: drink.id,
    name: line.name || drink.name,
    unitPrice,
    quantity: line.quantity,
    lineTotal: unitPrice * line.quantity,
    modifiers: line.modifiers,
    caffeineMg: caffeinePerUnit * line.quantity,
  };
}

export interface PriceCartInput {
  lines: readonly CartLine[];
  catalogue: ReadonlyMap<string, Drink>;
  fulfillment: 'delivery' | 'pickup';
  tip?: Paise;
  promo?: PromoCode | null;
  currency?: string;
}

/**
 * The authoritative cart price. Every total in the app comes from here —
 * the checkout summary, the order row, the receipt, the admin table.
 */
export function priceCart(input: PriceCartInput): PricedCart {
  const priced: PricedLine[] = [];
  for (const line of input.lines) {
    const drink = input.catalogue.get(line.drinkId);
    if (!drink || !drink.isAvailable) continue; // silently drop: the server decides what exists
    priced.push(priceLine(drink, line));
  }

  const subtotal = sum(priced.map((l) => l.lineTotal));
  const tax = pct(subtotal, TAX_PERCENT);

  const deliveryFee =
    input.fulfillment === 'pickup'
      ? PICKUP_FEE
      : subtotal >= FREE_DELIVERY_THRESHOLD
        ? 0
        : DELIVERY_FEE;

  const tip = Math.max(0, input.tip ?? 0);

  let discount = 0;
  if (input.promo && subtotal >= input.promo.minSubtotal) {
    discount =
      input.promo.kind === 'percent' ? pct(subtotal, input.promo.value) : input.promo.value;
    discount = Math.min(discount, subtotal); // a promo can never make an order negative
  }

  const total = subtotal + tax + deliveryFee + tip - discount;

  return {
    lines: priced,
    subtotal,
    tax,
    deliveryFee,
    tip,
    discount,
    total,
    currency: input.currency ?? 'INR',
    caffeineMg: priced.reduce((a, l) => a + l.caffeineMg, 0),
  };
}

/** Mirrors the `total_is_consistent` CHECK constraint (§4.2), in code. */
export function assertTotalConsistent(c: PricedCart): void {
  const expected = c.subtotal + c.tax + c.deliveryFee + c.tip - c.discount;
  if (c.total !== expected) {
    throw new Error(`total_is_consistent violated: ${c.total} !== ${expected}`);
  }
}
