/**
 * Server-owned pricing (Blueprint §9.1).
 *
 * The client runs this same pure function for instant feel; the server runs it
 * again against the stored catalogue before anything is persisted. The client's
 * number is read for comparison and then discarded — it is never written.
 */
import { pct, sum, type Paise } from './money';
import type {
  CartLine,
  Drink,
  Modifier,
  PricedCart,
  PricedLine,
  SelectedModifier,
} from './types';

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

/** The largest quantity one line may carry, mirroring the cart's own cap. */
export const MAX_LINE_QUANTITY = 20;

export type ModifierIndex = ReadonlyMap<string, Modifier>;

/** Modifier slugs are only unique WITHIN a kind, so the key carries both. */
export function modifierKey(kind: Modifier['kind'], slug: string): string {
  return `${kind}:${slug}`;
}

export function buildModifierIndex(modifiers: readonly Modifier[]): ModifierIndex {
  return new Map(modifiers.map((m) => [modifierKey(m.kind, m.slug), m]));
}

/**
 * Replace whatever the caller claimed about each modifier with what the
 * catalogue actually says.
 *
 * `SelectedModifier` arrives from the request body, so its `priceDelta` and
 * `caffeineDelta` are attacker-controlled: submitting `priceDelta: -17900`
 * against a ₹180 drink priced the order at ₹1.05 and it was persisted as
 * confirmed. Only the `kind`/`slug` pair is treated as input; every number and
 * the label are re-read from the stored modifier.
 *
 * An unrecognised pair is dropped rather than trusted, which is the same policy
 * `priceCart` already applies to an unrecognised drink.
 */
function resolveModifiers(
  selected: readonly SelectedModifier[],
  index: ModifierIndex | undefined,
): SelectedModifier[] {
  if (!index) return [...selected]; // no catalogue supplied: caller is the client's own preview
  const out: SelectedModifier[] = [];
  for (const m of selected) {
    const stored = index.get(modifierKey(m.kind, m.slug));
    if (!stored) continue;
    out.push({
      kind: stored.kind,
      slug: stored.slug,
      label: stored.label,
      priceDelta: stored.priceDelta,
      caffeineDelta: stored.caffeineDelta,
    });
  }
  return out;
}

/** A quantity from the wire may be negative, fractional, 1e12, or NaN. */
function safeQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 0;
  return Math.max(0, Math.min(MAX_LINE_QUANTITY, Math.floor(quantity)));
}

/** Unit price for one configured drink. Pure. */
export function priceLine(drink: Drink, line: CartLine, modifiers?: ModifierIndex): PricedLine {
  const resolved = resolveModifiers(line.modifiers ?? [], modifiers);
  const modifierDelta = sum(resolved.map((m) => m.priceDelta));
  const unitPrice = Math.max(0, drink.basePrice + modifierDelta);
  const caffeinePerUnit = Math.max(
    0,
    drink.caffeineMg + resolved.reduce((a, m) => a + m.caffeineDelta, 0),
  );
  const quantity = safeQuantity(line.quantity);
  return {
    lineId: line.lineId,
    drinkId: drink.id,
    // The catalogue's name, not the line's: the line arrives off the wire, and
    // whatever it calls itself must not end up printed on the receipt.
    name: drink.name,
    unitPrice,
    quantity,
    lineTotal: unitPrice * quantity,
    modifiers: resolved,
    caffeineMg: caffeinePerUnit * quantity,
  };
}

export interface PriceCartInput {
  lines: readonly CartLine[];
  catalogue: ReadonlyMap<string, Drink>;
  /**
   * The stored modifier catalogue. Supply this on EVERY server path — without
   * it the submitted price deltas are taken at face value, which is only safe
   * for the client's own optimistic preview.
   */
  modifiers?: ModifierIndex;
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
    priced.push(priceLine(drink, line, input.modifiers));
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
