import {
  catalogueMap,
  getOrigin,
  listDrinks,
  listModifiers,
  listOrigins,
  listReviews,
  ratingSummary,
  searchDrinks,
} from '@/repositories';
import { CATEGORIES } from '@/data/drinks';
import { priceCart, findPromo, buildModifierIndex } from '@/domain/pricing';
import { buildPreview, defaultSelection } from '@/domain/brew-plan';
import type { CartLine, Drink, SelectedModifier } from '@/domain/types';

export async function getMenu() {
  const [drinks, modifiers, origins] = await Promise.all([
    listDrinks(),
    listModifiers(),
    listOrigins(),
  ]);
  return { drinks, modifiers, origins, categories: CATEGORIES };
}

export async function getDrinkPage(slug: string) {
  // Drinks only: the sellable map also resolves pairings by slug, and a plate
  // of biscotti rendered through the Brew Builder is not a page we have.
  const drink = (await listDrinks()).find((d) => d.slug === slug);
  if (!drink) return null;
  const [modifiers, reviews, rating, origins] = await Promise.all([
    listModifiers(),
    listReviews(drink.id),
    ratingSummary(drink.id),
    listOrigins(),
  ]);
  const origin = drink.originId ? origins.find((o) => o.id === drink.originId) ?? null : null;
  const defaults = defaultSelection(drink, modifiers);
  return {
    drink,
    modifiers,
    reviews,
    rating,
    origin,
    defaults,
    preview: buildPreview(drink, defaults),
  };
}

export async function search(q: string) {
  return searchDrinks(q);
}

/**
 * The authoritative quote for a single Brew Builder configuration (§9.1).
 * The client runs the same pure function for instant feel; this is the number
 * that is actually true.
 */
export async function quote(drinkId: string, selected: SelectedModifier[], quantity: number) {
  const catalogue = await catalogueMap();
  const drink = catalogue.get(drinkId);
  if (!drink) return null;

  const line: CartLine = {
    lineId: 'quote',
    drinkId,
    slug: drink.slug,
    name: drink.name,
    imageUrl: drink.imageUrl,
    quantity: Math.max(1, quantity),
    modifiers: selected,
  };
  const priced = priceCart({
    lines: [line],
    catalogue,
    modifiers: buildModifierIndex(await listModifiers()),
    fulfillment: 'pickup',
  });
  return {
    unitPrice: priced.lines[0]?.unitPrice ?? drink.basePrice,
    lineTotal: priced.lines[0]?.lineTotal ?? drink.basePrice,
    preview: buildPreview(drink, selected),
  };
}

/** Authoritative cart totals — the number checkout is allowed to show. */
export async function previewCart(input: {
  lines: CartLine[];
  fulfillment: 'delivery' | 'pickup';
  tip?: number;
  promoCode?: string | null;
}) {
  const [catalogue, modifiers] = await Promise.all([catalogueMap(), listModifiers()]);
  return priceCart({
    lines: input.lines,
    catalogue,
    modifiers: buildModifierIndex(modifiers),
    fulfillment: input.fulfillment,
    tip: input.tip,
    promo: findPromo(input.promoCode),
  });
}

export async function getOriginPage(slug: string) {
  const [origin, drinks] = await Promise.all([getOrigin(slug), listDrinks()]);
  if (!origin) return null;
  return { origin, drinks: drinks.filter((d) => d.originId === origin.id) };
}

/** Weather-aware surfacing (§6.4) — opt-in, never reorders silently. */
export function rankForWeather(drinks: Drink[], suggestion: string): Drink[] {
  const score = (d: Drink) => {
    if (suggestion === 'iced' || suggestion === 'cold-brew') return d.isIced ? -1 : 0;
    if (suggestion === 'dark-roast') return d.roast === 'dark' || d.roast === 'medium_dark' ? -1 : 0;
    return 0;
  };
  return [...drinks].sort((a, b) => score(a) - score(b) || a.sortOrder - b.sortOrder);
}
