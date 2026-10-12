import type { Pairing } from '@/domain/types';

/**
 * Twelve hand-picked eatables that pair with coffee. Each one is a small, focused
 * thing — a biscotti, a tart, a bite — not a menu that pretends to be a bakery.
 * Images are Unsplash photos, each checked against the dish it names.
 * `pairsWith` lists the drink slugs a plate was tasted against — the cart
 * uses it to suggest a plate when one of those drinks goes in.
 */
export const PAIRINGS: Pairing[] = [
  {
    id: 'prn-biscotti',
    slug: 'dark-chocolate-almond-biscotti',
    name: 'Dark Chocolate Almond Biscotti',
    description: 'Twice-baked, dunked once. The crunch is the point.',
    pairingNote: 'Best with Halo Espresso or Long Black — the bitterness cuts through the chocolate.',
    imageUrl: 'https://images.unsplash.com/photo-1777665998483-54f328e79eeb?w=600&auto=format&fit=crop&q=80',
    pairsWith: ['halo-espresso', 'long-black'],
    price: 18000,
    allergens: ['gluten', 'dairy', 'nuts'],
    isAvailable: true,
    sortOrder: 1,
  },
  {
    id: 'prn-tart',
    slug: 'salted-caramel-tart',
    name: 'Salted Caramel Tart',
    description: 'A 6cm disc of burnt sugar, shortcrust, and one grain of flaky salt.',
    pairingNote: 'Lift the acidity of a Cortado or Flat White — salt makes sweet taste sweeter and coffee taste brighter.',
    imageUrl: 'https://images.unsplash.com/photo-1547414368-ac947d00b91d?w=600&auto=format&fit=crop&q=80',
    pairsWith: ['cortado', 'flat-white'],
    price: 22000,
    allergens: ['gluten', 'dairy', 'eggs'],
    isAvailable: true,
    sortOrder: 2,
  },
  {
    id: 'prn-pannacotta',
    slug: 'vanilla-bean-panna-cotta',
    name: 'Vanilla Bean Panna Cotta',
    description: 'Three ingredients, set just. No gelatin, no stabiliser.',
    pairingNote: 'The cream body mirrors milk drinks — try with Aura Latte or Cappuccino for a seamless texture bridge.',
    imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&auto=format&fit=crop&q=80',
    pairsWith: ['aura-latte', 'cappuccino'],
    price: 20000,
    allergens: ['dairy'],
    isAvailable: true,
    sortOrder: 3,
  },
  {
    id: 'prn-madeleine',
    slug: 'matcha-madeleine',
    name: 'Matcha Madeleine',
    description: 'Green tea folded into the shell, lemon zest on the outside.',
    pairingNote: 'The grassy bitterness echoes light-roast filter coffee — V60 Pour-Over or Chemex Carafe are its natural matches.',
    imageUrl: 'https://images.unsplash.com/photo-1607174644416-25df985337f6?w=600&auto=format&fit=crop&q=80',
    pairsWith: ['v60-pour-over', 'chemex-carafe'],
    price: 15000,
    allergens: ['gluten', 'dairy', 'eggs'],
    isAvailable: true,
    sortOrder: 4,
  },
  {
    id: 'prn-brownie',
    slug: 'espresso-brownie-bite',
    name: 'Espresso Brownie Bite',
    description: 'Fudgy centre, cracked top, a shot of the house espresso in the batter.',
    pairingNote: 'Coffee inside and outside — pair with Cold Brew or Iced Latte for a double-down on intensity.',
    imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&auto=format&fit=crop&q=80',
    pairsWith: ['cold-brew', 'iced-latte'],
    price: 17000,
    allergens: ['gluten', 'dairy', 'eggs'],
    isAvailable: true,
    sortOrder: 5,
  },
  {
    id: 'prn-shortbread',
    slug: 'lavender-shortbread',
    name: 'Lavender Shortbread',
    description: 'High-fat butter, low gluten, a single brush of culinary lavender.',
    pairingNote: 'The floral note lifts the jasmine in Yercaud Chandragiri — try with Long Black or AeroPress.',
    imageUrl: 'https://images.unsplash.com/photo-1630782622114-613e6e9c5dc6?w=600&auto=format&fit=crop&q=80',
    pairsWith: ['long-black', 'aeropress'],
    price: 16000,
    allergens: ['gluten', 'dairy'],
    isAvailable: true,
    sortOrder: 6,
  },
  {
    id: 'prn-croissant',
    slug: 'salted-butter-croissant',
    name: 'Salted Butter Croissant',
    description: '72-hour laminated dough, Maldon on top. The layers shatter cleanly.',
    pairingNote: 'Butter and croissant are the original pairings. Pair with Flat White for the classic café moment.',
    imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80',
    pairsWith: ['flat-white', 'cappuccino', 'aura-latte'],
    price: 19000,
    allergens: ['gluten', 'dairy'],
    isAvailable: true,
    sortOrder: 7,
  },
  {
    id: 'prn-tiramisu',
    slug: 'mini-tiramisu',
    name: 'Mini Tiramisu',
    description: 'Espresso-soaked savoiardi, mascarpone set just. One spoonful, no cutlery needed.',
    pairingNote: 'Built on the same espresso you are drinking. Pair with a double shot for a full-circle moment.',
    imageUrl: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&auto=format&fit=crop&q=80',
    pairsWith: ['halo-espresso', 'affogato'],
    price: 24000,
    allergens: ['gluten', 'dairy', 'eggs'],
    isAvailable: true,
    sortOrder: 8,
  },
  {
    id: 'prn-macaron',
    slug: 'coffee-macaron',
    name: 'Coffee Macaron',
    description: 'Ganache centre, crisp shell, coffee aroma through the whole thing.',
    pairingNote: 'A meringue-based bite that mirrors the drink. Try with Pour Over for a conversation between light and sweet.',
    imageUrl: 'https://images.unsplash.com/photo-1569864358642-9d1684040f43?w=600&auto=format&fit=crop&q=80',
    pairsWith: ['v60-pour-over', 'aeropress'],
    price: 20000,
    allergens: ['gluten', 'dairy', 'eggs', 'nuts'],
    isAvailable: true,
    sortOrder: 9,
  },
  {
    id: 'prn-mousse',
    slug: 'dark-chocolate-mousse',
    name: 'Dark Chocolate Mousse',
    description: '70% cacao, aerated by hand. No cream, no stabiliser, no compromise.',
    pairingNote: 'The bitterness of the mousse demands a dark roast — Mocha or Cortado are the natural counterpoints.',
    imageUrl: 'https://images.unsplash.com/photo-1673551494277-92204546b504?w=600&auto=format&fit=crop&q=80',
    pairsWith: ['burnt-honey-mocha', 'cortado'],
    price: 21000,
    allergens: ['dairy', 'eggs'],
    isAvailable: true,
    sortOrder: 10,
  },
  {
    id: 'prn-painperdu',
    slug: 'cardamom-pain-perdu',
    name: 'Cardamom Pain Perdu',
    description: 'Thick-cut brioche, custard-soaked, cardamom in the syrup. A breakfast dish, served all day.',
    pairingNote: 'Spice and custard open up the fruit notes in Chikmagalur beans — try with Chai or Caffè Latte.',
    imageUrl: 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=600&auto=format&fit=crop&q=80',
    pairsWith: ['cardamom-cutting-chai', 'aura-latte'],
    price: 23000,
    allergens: ['gluten', 'dairy', 'eggs'],
    isAvailable: true,
    sortOrder: 11,
  },
  {
    id: 'prn-cheesecake',
    slug: 'passionfruit-cheesecake',
    name: 'Passionfruit Cheesecake',
    description: 'New York-style base, passionfruit curd on top. Tart enough to make you close your eyes.',
    pairingNote: 'The tropical acidity wakes up your palate between sips of Iced Americano or Cold Brew.',
    imageUrl: 'https://images.unsplash.com/photo-1524351199678-941a58a3df50?w=600&auto=format&fit=crop&q=80',
    pairsWith: ['cold-brew', 'cascara-tonic'],
    price: 22000,
    allergens: ['gluten', 'dairy'],
    isAvailable: true,
    sortOrder: 12,
  },
];

export const PAIRING_BY_SLUG = new Map(PAIRINGS.map((p) => [p.slug, p]));
export const PAIRING_BY_ID = new Map(PAIRINGS.map((p) => [p.id, p]));

/**
 * Plates to suggest for what is already in the cart, best match first.
 *
 * A plate tasted against a drink in the cart scores per match; plates already
 * in the cart are skipped. With nothing to match (an empty cart, or only
 * beans), the first few plates by house order stand in, so the drawer never
 * shows an empty "goes well with" row.
 */
export function suggestPairings(
  cart: readonly { drinkId: string; slug: string }[],
  limit = 3,
): Pairing[] {
  const inCart = new Set(cart.map((l) => l.drinkId));
  const drinkSlugs = new Set(cart.map((l) => l.slug));
  const open = PAIRINGS.filter((p) => p.isAvailable && !inCart.has(p.id));
  const scored = open
    .map((p) => ({ p, score: p.pairsWith.filter((s) => drinkSlugs.has(s)).length }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.p.sortOrder - b.p.sortOrder)
    .map((r) => r.p);
  if (scored.length >= limit) return scored.slice(0, limit);
  const rest = open.filter((p) => !scored.includes(p)).sort((a, b) => a.sortOrder - b.sortOrder);
  return [...scored, ...rest].slice(0, limit);
}

/** The drinks a plate was tasted against, by slug — for "pairs with" labels. */
export function pairingFor(drinkSlug: string): Pairing[] {
  return PAIRINGS.filter((p) => p.isAvailable && p.pairsWith.includes(drinkSlug));
}
