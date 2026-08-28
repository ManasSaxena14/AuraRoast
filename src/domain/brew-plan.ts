/**
 * Brew Builder domain — the live tasting-note and caffeine preview (§2.1).
 * Pure: the same function runs on the client for instant feel and on the
 * server for truth.
 */
import type { Drink, Modifier, ModifierKind, SelectedModifier } from './types';

export const MODIFIER_ORDER: ModifierKind[] = ['size', 'milk', 'shot', 'syrup', 'temperature'];

export const MODIFIER_LABELS: Record<ModifierKind, string> = {
  size: 'Size',
  milk: 'Milk',
  shot: 'Shots',
  syrup: 'Syrup',
  temperature: 'Temperature',
};

export interface BrewPreview {
  caffeineMg: number;
  intensity: number; // 1–5
  notes: string[];
  /** 0–1 — how much of the builder the guest has actually engaged with. */
  completeness: number;
  dairyFree: boolean;
  volumeMl: number;
}

const SIZE_ML: Record<string, number> = { short: 180, regular: 240, long: 350, carafe: 500 };

const MILK_NOTES: Record<string, string> = {
  whole: 'rounded, custard-like body',
  oat: 'malted sweetness, silky',
  almond: 'dry finish, marzipan edge',
  soy: 'nutty, softens acidity',
  none: 'unmasked — the origin speaks',
};

const SYRUP_NOTES: Record<string, string> = {
  vanilla: 'vanilla bean warmth',
  cardamom: 'green cardamom lift',
  jaggery: 'jaggery caramel',
  'burnt-honey': 'burnt honey, smoky sweet',
};

export function buildPreview(
  drink: Drink,
  selected: readonly SelectedModifier[],
): BrewPreview {
  const bySlug = new Map(selected.map((m) => [m.kind, m]));

  const caffeineMg = Math.max(
    0,
    drink.caffeineMg + selected.reduce((a, m) => a + m.caffeineDelta, 0),
  );

  const size = bySlug.get('size')?.slug ?? 'regular';
  const milk = bySlug.get('milk')?.slug ?? 'none';
  const syrup = bySlug.get('syrup')?.slug;
  const shots = bySlug.get('shot')?.slug ?? 'single';

  const notes = [...drink.tastingNotes];
  if (MILK_NOTES[milk]) notes.push(MILK_NOTES[milk]);
  if (syrup && SYRUP_NOTES[syrup]) notes.push(SYRUP_NOTES[syrup]);

  let intensity = drink.intensity;
  if (shots === 'double') intensity = Math.min(5, intensity + 1);
  if (shots === 'triple') intensity = Math.min(5, intensity + 2);
  if (milk !== 'none') intensity = Math.max(1, intensity - 1);

  const engaged = MODIFIER_ORDER.filter(
    (k) => drink.allowedModifiers.includes(k) && bySlug.has(k),
  ).length;
  const possible = Math.max(1, drink.allowedModifiers.length);

  return {
    caffeineMg,
    intensity,
    notes: notes.slice(0, 5),
    completeness: Math.min(1, engaged / possible),
    dairyFree: selected.every((m) => m.kind !== 'milk' || isDairyFree(m.slug)),
    volumeMl: SIZE_ML[size] ?? 240,
  };
}

function isDairyFree(slug: string): boolean {
  return slug !== 'whole' && slug !== 'skim';
}

/** The default configuration a drink opens with. */
export function defaultSelection(drink: Drink, modifiers: readonly Modifier[]): SelectedModifier[] {
  const out: SelectedModifier[] = [];
  for (const kind of MODIFIER_ORDER) {
    if (!drink.allowedModifiers.includes(kind)) continue;
    const wantedSlug = drink.defaultModifiers[kind];
    const m =
      modifiers.find((x) => x.kind === kind && x.slug === wantedSlug) ??
      modifiers.filter((x) => x.kind === kind).sort((a, b) => a.sortOrder - b.sortOrder)[0];
    if (m) {
      out.push({
        kind: m.kind,
        slug: m.slug,
        label: m.label,
        priceDelta: m.priceDelta,
        caffeineDelta: m.caffeineDelta,
      });
    }
  }
  return out;
}

export function describeSelection(selected: readonly SelectedModifier[]): string {
  return selected
    .filter((m) => m.slug !== 'none' && m.slug !== 'regular' && m.slug !== 'hot')
    .map((m) => m.label)
    .join(' · ');
}
