/**
 * Idempotent seed (Blueprint §4.6). Running it twice changes nothing.
 *
 * The same seed data the in-process adapter uses, so the two backends are
 * never out of step — one source, two destinations.
 *
 *   DATABASE_URL_UNPOOLED=... npx tsx drizzle/seed.ts
 */
import { DRINKS, CATEGORIES } from '../src/data/drinks';
import { GUIDES } from '../src/data/guides';
import { MODIFIERS } from '../src/data/modifiers';
import { ORIGINS } from '../src/data/origins';
import { STORES } from '../src/data/stores';
import { TIERS } from '../src/domain/loyalty';
import { slotTimesForDay, toDateKey } from '../src/domain/slots';
try {
  process.loadEnvFile('.env.local');
} catch {}

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

  if (!url) {
    console.log(
      [
        'No DATABASE_URL set — nothing to seed.',
        '',
        'That is not an error. Without a database the app runs on the in-process',
        'adapter, which is seeded from these exact same files at boot:',
        '',
        `  origins    ${ORIGINS.length}`,
        `  drinks     ${DRINKS.length} across ${CATEGORIES.length} categories`,
        `  modifiers  ${MODIFIERS.length}`,
        `  stores     ${STORES.length}`,
        `  guides     ${GUIDES.length}`,
        `  tiers      ${TIERS.length}`,
        `  slots      ${STORES.length * slotTimesForDay().length} per day × 21 days from ${toDateKey(new Date())}`,
        '',
        'Set DATABASE_URL_UNPOOLED to seed a real Neon branch instead.',
      ].join('\n'),
    );
    return;
  }

  // Real Postgres path. `onConflictDoUpdate` on the natural key is what makes
  // this idempotent — re-running it converges, it does not duplicate.
  const { drizzle } = await import('drizzle-orm/neon-http');
  const { neon } = await import('@neondatabase/serverless');
  const schema = await import('../src/repositories/schema');

  const db = drizzle(neon(url));

  await db
    .insert(schema.origins)
    .values(
      ORIGINS.map((o) => ({
        slug: o.slug,
        name: o.name,
        country: o.country,
        lat: o.lat,
        lng: o.lng,
        altitudeM: o.altitudeM,
        process: o.process,
        farmerName: o.farmerName,
        farmerStory: o.farmerStory,
        varietal: o.varietal,
        harvest: o.harvest,
        heroImage: o.heroImage,
      })),
    )
    .onConflictDoNothing({ target: schema.origins.slug });

  await db
    .insert(schema.stores)
    .values(
      STORES.map((s) => ({
        slug: s.slug,
        name: s.name,
        address: s.address,
        city: s.city,
        lat: s.lat,
        lng: s.lng,
        phone: s.phone,
        blurb: s.blurb,
        hours: s.hours,
        isActive: s.isActive,
      })),
    )
    .onConflictDoNothing({ target: schema.stores.slug });

  await db
    .insert(schema.modifiers)
    .values(
      MODIFIERS.map((m) => ({
        kind: m.kind,
        slug: m.slug,
        label: m.label,
        priceDelta: m.priceDelta,
        caffeineDelta: m.caffeineDelta,
        isDairyFree: m.isDairyFree,
        note: m.note,
        sortOrder: m.sortOrder,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.guides)
    .values(
      GUIDES.map((g) => ({
        slug: g.slug,
        method: g.method,
        summary: g.summary,
        ratio: g.ratio,
        grind: g.grind,
        totalSeconds: g.totalSeconds,
        difficulty: g.difficulty,
        yieldMl: g.yieldMl,
        image: g.image,
        steps: g.steps,
      })),
    )
    .onConflictDoNothing({ target: schema.guides.slug });

  const insertedOrigins = await db
    .select({ id: schema.origins.id, slug: schema.origins.slug })
    .from(schema.origins);
  const originMap = new Map(insertedOrigins.map((o) => [o.slug, o.id]));

  await db
    .insert(schema.drinks)
    .values(
      DRINKS.map((d) => {
        const originSlug = d.originId ? d.originId.replace(/^org-/, '') : null;
        return {
          slug: d.slug,
          name: d.name,
          category: d.category,
          originId: originSlug ? (originMap.get(originSlug) ?? null) : null,
          roast: d.roast,
          description: d.description,
          longDescription: d.longDescription,
          tastingNotes: d.tastingNotes,
          allergens: d.allergens,
          caffeineMg: d.caffeineMg,
          basePrice: d.basePrice,
          imageUrl: d.imageUrl,
          isSeasonal: d.isSeasonal,
          isAvailable: d.isAvailable,
          isIced: d.isIced,
          intensity: d.intensity,
          sortOrder: d.sortOrder,
        };
      }),
    )
    .onConflictDoNothing({ target: schema.drinks.slug });

  console.log('Seed complete — re-running changes nothing.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
