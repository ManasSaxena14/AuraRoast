import type { Modifier } from '@/domain/types';

/** One discriminated table, not five near-identical ones (Blueprint §4.2). */
export const MODIFIERS: Modifier[] = [
  // ── size ──────────────────────────────────────────────────────────
  { id: 'mod-size-short', kind: 'size', slug: 'short', label: 'Short · 180ml', priceDelta: -3000, caffeineDelta: -15, isDairyFree: true, sortOrder: 1, note: 'Concentrated. Drink it standing up.' },
  { id: 'mod-size-regular', kind: 'size', slug: 'regular', label: 'Regular · 240ml', priceDelta: 0, caffeineDelta: 0, isDairyFree: true, sortOrder: 2, note: 'The size the recipe was built for.' },
  { id: 'mod-size-long', kind: 'size', slug: 'long', label: 'Long · 350ml', priceDelta: 4000, caffeineDelta: 30, isDairyFree: true, sortOrder: 3, note: 'More water, same dose. Softer, longer.' },
  { id: 'mod-size-carafe', kind: 'size', slug: 'carafe', label: 'Carafe · 500ml', priceDelta: 9000, caffeineDelta: 70, isDairyFree: true, sortOrder: 4, note: 'For two, or for a long morning.' },

  // ── milk ──────────────────────────────────────────────────────────
  { id: 'mod-milk-none', kind: 'milk', slug: 'none', label: 'No milk', priceDelta: 0, caffeineDelta: 0, isDairyFree: true, sortOrder: 1, note: 'Nothing between you and the origin.' },
  { id: 'mod-milk-whole', kind: 'milk', slug: 'whole', label: 'Whole milk', priceDelta: 0, caffeineDelta: 0, isDairyFree: false, sortOrder: 2, note: 'Rounded, custard body.' },
  { id: 'mod-milk-oat', kind: 'milk', slug: 'oat', label: 'Oat', priceDelta: 3000, caffeineDelta: 0, isDairyFree: true, sortOrder: 3, note: 'Malted, silky, steams like dairy.' },
  { id: 'mod-milk-almond', kind: 'milk', slug: 'almond', label: 'Almond', priceDelta: 3000, caffeineDelta: 0, isDairyFree: true, sortOrder: 4, note: 'Dry finish, marzipan edge.' },
  { id: 'mod-milk-soy', kind: 'milk', slug: 'soy', label: 'Soy', priceDelta: 2500, caffeineDelta: 0, isDairyFree: true, sortOrder: 5, note: 'Nutty. Softens acidity noticeably.' },

  // ── shots ─────────────────────────────────────────────────────────
  { id: 'mod-shot-single', kind: 'shot', slug: 'single', label: 'Single', priceDelta: 0, caffeineDelta: 0, isDairyFree: true, sortOrder: 1 },
  { id: 'mod-shot-double', kind: 'shot', slug: 'double', label: 'Double', priceDelta: 4500, caffeineDelta: 63, isDairyFree: true, sortOrder: 2 },
  { id: 'mod-shot-triple', kind: 'shot', slug: 'triple', label: 'Triple', priceDelta: 8500, caffeineDelta: 126, isDairyFree: true, sortOrder: 3, note: 'We will ask if you are sure.' },

  // ── syrup ─────────────────────────────────────────────────────────
  { id: 'mod-syrup-none', kind: 'syrup', slug: 'none', label: 'None', priceDelta: 0, caffeineDelta: 0, isDairyFree: true, sortOrder: 1 },
  { id: 'mod-syrup-vanilla', kind: 'syrup', slug: 'vanilla', label: 'Vanilla bean', priceDelta: 2500, caffeineDelta: 0, isDairyFree: true, sortOrder: 2 },
  { id: 'mod-syrup-cardamom', kind: 'syrup', slug: 'cardamom', label: 'Green cardamom', priceDelta: 3000, caffeineDelta: 0, isDairyFree: true, sortOrder: 3 },
  { id: 'mod-syrup-jaggery', kind: 'syrup', slug: 'jaggery', label: 'Jaggery', priceDelta: 2500, caffeineDelta: 0, isDairyFree: true, sortOrder: 4 },
  { id: 'mod-syrup-burnt-honey', kind: 'syrup', slug: 'burnt-honey', label: 'Burnt honey', priceDelta: 3500, caffeineDelta: 0, isDairyFree: true, sortOrder: 5 },

  // ── temperature ───────────────────────────────────────────────────
  { id: 'mod-temp-hot', kind: 'temperature', slug: 'hot', label: 'Hot', priceDelta: 0, caffeineDelta: 0, isDairyFree: true, sortOrder: 1 },
  { id: 'mod-temp-warm', kind: 'temperature', slug: 'warm', label: 'Warm · 60°C', priceDelta: 0, caffeineDelta: 0, isDairyFree: true, sortOrder: 2, note: 'Drinkable immediately. Loses less aroma.' },
  { id: 'mod-temp-iced', kind: 'temperature', slug: 'iced', label: 'Iced', priceDelta: 2000, caffeineDelta: 0, isDairyFree: true, sortOrder: 3 },
];

export const MODIFIER_BY_ID = new Map(MODIFIERS.map((m) => [m.id, m]));

export function modifiersOfKind(kind: Modifier['kind']): Modifier[] {
  return MODIFIERS.filter((m) => m.kind === kind).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function findModifier(kind: Modifier['kind'], slug: string): Modifier | undefined {
  return MODIFIERS.find((m) => m.kind === kind && m.slug === slug);
}
