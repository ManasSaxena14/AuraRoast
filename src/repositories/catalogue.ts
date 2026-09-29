/**
 * The catalogue — drinks, origins and rooms — as ONE cached, normalised
 * snapshot.
 *
 * Two problems this exists to solve:
 *
 *   1. Identity. The static files name things `drk-halo-espresso`,
 *      `str-indiranagar`; Postgres gave the same rows random UUIDs. Handing
 *      the UUIDs to the app while search, reviews, subscriptions, the Barista
 *      and the reservation slots all used the static ids meant nothing matched
 *      once the database was seeded — the slot grid for every room came back
 *      empty. The app now sees ONE id per thing (the static id wherever one
 *      exists, matched by slug) and the UUIDs only ever cross the database
 *      boundary, through the maps below.
 *
 *   2. Cost. The root layout reads the catalogue on every dynamic render. A
 *      round trip to Postgres per page view for data that changes a few times
 *      a year is pure latency, so the snapshot is held for a minute.
 *
 * Postgres still wins on what it stores — edit a price or mark a drink sold
 * out in `npm run db:studio` and it is live within a minute.
 */
import { DRINKS } from '@/data/drinks';
import { ORIGINS } from '@/data/origins';
import { STORES } from '@/data/stores';
import { PAIRINGS } from '@/data/pairings';
import type { Drink, Origin, RoastLevel, Store } from '@/domain/types';
import * as schema from './schema';
import { getDb } from './client';

export interface CatalogueSnapshot {
  drinks: Drink[];
  origins: Origin[];
  /** Every room, active or not — `listStores()` filters. */
  stores: Store[];
  source: 'postgres' | 'static';
  /** App id → database UUID, for foreign keys on the way in. */
  drinkDbId: Map<string, string>;
  storeDbId: Map<string, string>;
  /** Database UUID → app id, for rows on the way out. */
  drinkAppId: Map<string, string>;
  storeAppId: Map<string, string>;
}

const TTL_MS = 60_000;
/** A failed read is retried sooner than a good one is refreshed. */
const FAILURE_TTL_MS = 10_000;

const STATIC_DRINK_BY_SLUG = new Map(DRINKS.map((d) => [d.slug, d]));
const STATIC_ORIGIN_BY_SLUG = new Map(ORIGINS.map((o) => [o.slug, o]));
const STATIC_STORE_BY_SLUG = new Map(STORES.map((s) => [s.slug, s]));

function staticSnapshot(): CatalogueSnapshot {
  return {
    drinks: [...DRINKS].sort((a, b) => a.sortOrder - b.sortOrder),
    origins: ORIGINS,
    stores: STORES,
    source: 'static',
    drinkDbId: new Map(),
    storeDbId: new Map(),
    drinkAppId: new Map(),
    storeAppId: new Map(),
  };
}

async function loadFromPostgres(): Promise<CatalogueSnapshot | null> {
  const db = await getDb();
  if (!db) return null;

  const [drinkRows, originRows, storeRows] = await Promise.all([
    db.select().from(schema.drinks).orderBy(schema.drinks.sortOrder),
    db.select().from(schema.origins),
    db.select().from(schema.stores),
  ]);

  const snap = staticSnapshot();
  snap.source = 'postgres';

  const originAppId = new Map<string, string>();
  if (originRows.length) {
    snap.origins = originRows.map((r) => {
      const match = STATIC_ORIGIN_BY_SLUG.get(r.slug);
      const id = match?.id ?? r.id;
      originAppId.set(r.id, id);
      return {
        id,
        slug: r.slug,
        name: r.name,
        country: r.country,
        lat: r.lat,
        lng: r.lng,
        altitudeM: r.altitudeM ?? match?.altitudeM ?? 0,
        process: r.process ?? match?.process ?? '',
        farmerName: r.farmerName ?? match?.farmerName ?? '',
        farmerStory: r.farmerStory ?? match?.farmerStory ?? '',
        heroImage: r.heroImage ?? match?.heroImage ?? '',
        varietal: r.varietal ?? match?.varietal ?? '',
        harvest: r.harvest ?? match?.harvest ?? '',
      };
    });
  }

  if (drinkRows.length) {
    snap.drinks = drinkRows.map((r) => {
      const match = STATIC_DRINK_BY_SLUG.get(r.slug);
      const id = match?.id ?? r.id;
      snap.drinkDbId.set(id, r.id);
      snap.drinkAppId.set(r.id, id);
      return {
        id,
        slug: r.slug,
        name: r.name,
        category: r.category,
        originId: r.originId ? (originAppId.get(r.originId) ?? r.originId) : (match?.originId ?? null),
        roast: (r.roast as RoastLevel | null) ?? match?.roast ?? null,
        description: r.description,
        longDescription: r.longDescription ?? match?.longDescription ?? '',
        tastingNotes: r.tastingNotes?.length ? r.tastingNotes : (match?.tastingNotes ?? []),
        allergens: r.allergens ?? match?.allergens ?? [],
        caffeineMg: r.caffeineMg,
        basePrice: r.basePrice,
        imageUrl: r.imageUrl ?? match?.imageUrl ?? '',
        isSeasonal: r.isSeasonal,
        isAvailable: r.isAvailable,
        isIced: r.isIced,
        intensity: r.intensity,
        sortOrder: r.sortOrder,
        allowedModifiers: match?.allowedModifiers ?? ['size', 'milk', 'shot', 'syrup', 'temperature'],
        defaultModifiers: match?.defaultModifiers ?? { size: 'regular', milk: 'whole' },
      };
    });
  }

  if (storeRows.length) {
    snap.stores = storeRows.map((r) => {
      const match = STATIC_STORE_BY_SLUG.get(r.slug);
      const id = match?.id ?? r.id;
      snap.storeDbId.set(id, r.id);
      snap.storeAppId.set(r.id, id);
      return {
        id,
        slug: r.slug,
        name: r.name,
        address: r.address,
        city: r.city,
        lat: r.lat,
        lng: r.lng,
        phone: r.phone ?? match?.phone ?? '',
        hours: (r.hours as Record<string, [string, string]> | null) ?? match?.hours ?? {},
        isActive: r.isActive,
        blurb: r.blurb ?? match?.blurb ?? '',
      };
    });
    // Rooms keep the static city order, which every store picker groups by.
    const order = new Map(STORES.map((s, i) => [s.slug, i]));
    snap.stores.sort((a, b) => (order.get(a.slug) ?? 999) - (order.get(b.slug) ?? 999));
  }

  return snap;
}

const g = globalThis as unknown as {
  __auraCatalogue?: { snap: CatalogueSnapshot; expires: number };
  __auraCatalogueLoading?: Promise<CatalogueSnapshot>;
};

let warned = false;

export async function catalogueSnapshot(): Promise<CatalogueSnapshot> {
  const hit = g.__auraCatalogue;
  if (hit && hit.expires > Date.now()) return hit.snap;
  if (g.__auraCatalogueLoading) return g.__auraCatalogueLoading;

  g.__auraCatalogueLoading = (async () => {
    try {
      const snap = (await loadFromPostgres()) ?? staticSnapshot();
      g.__auraCatalogue = { snap, expires: Date.now() + TTL_MS };
      return snap;
    } catch (err) {
      if (!warned) {
        warned = true;
        console.warn('[catalogue] Postgres read failed, serving the static catalogue:', err);
      }
      // Keep serving the last good snapshot if there is one.
      const snap = hit?.snap ?? staticSnapshot();
      g.__auraCatalogue = { snap, expires: Date.now() + FAILURE_TTL_MS };
      return snap;
    } finally {
      g.__auraCatalogueLoading = undefined;
    }
  })();
  return g.__auraCatalogueLoading;
}

/** Pairings are sold through the same cart and priced by the same function. */
export function pairingAsDrink(p: (typeof PAIRINGS)[number]): Drink {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: 'pairings',
    originId: null,
    roast: null,
    description: p.description,
    longDescription: p.pairingNote,
    tastingNotes: [],
    allergens: p.allergens,
    caffeineMg: 0,
    basePrice: p.price,
    imageUrl: p.imageUrl,
    isSeasonal: false,
    isAvailable: p.isAvailable,
    isIced: false,
    intensity: 0,
    sortOrder: 200 + p.sortOrder,
    allowedModifiers: [],
    defaultModifiers: {},
  };
}

/**
 * Every sellable thing, under every name a cart line might carry: the app id,
 * the slug, the legacy `pairing-` key and — so carts saved while the app still
 * handed out raw UUIDs keep pricing — the database UUID.
 */
export async function sellableMap(): Promise<Map<string, Drink>> {
  const snap = await catalogueSnapshot();
  const map = new Map<string, Drink>();
  for (const d of snap.drinks) {
    map.set(d.id, d);
    map.set(d.slug, d);
    const dbId = snap.drinkDbId.get(d.id);
    if (dbId) map.set(dbId, d);
  }
  for (const p of PAIRINGS) {
    const item = pairingAsDrink(p);
    map.set(p.id, item);
    map.set(p.slug, item);
    map.set(`pairing-${p.id}`, item);
  }
  return map;
}
