/**
 * The repository API. Services depend on THIS, never on a driver.
 *
 * Two adapters implement it:
 *
 *   · `./pg.ts` — Postgres (Neon over HTTP, or any Postgres over node-postgres),
 *     selected whenever `DATABASE_URL` is set. It is the ONLY source of truth
 *     then: on a serverless host every request may land on a different
 *     instance, so nothing transactional is ever read back from memory.
 *   · the in-process adapter below (`./memory/store.ts`) — zero credentials,
 *     the whole product end to end, for local development and review.
 *
 * Both honour the same correctness rules (Part 9): the atomic capacity check,
 * idempotency with three distinct outcomes, and loyalty derived on read.
 *
 * The catalogue is shared by both: `./catalogue.ts` serves one normalised,
 * cached snapshot whichever backend holds it.
 */
import { deriveLoyalty } from '@/domain/loyalty';
import { SlotFullError } from '@/domain/errors';
import { seatsConsumed } from '@/domain/slots';
import { orderNumber as mintOrderNumber, shortCode } from '@/lib/ids';
import { GUIDES } from '@/data/guides';
import { MODIFIERS } from '@/data/modifiers';
import type {
  Drink,
  Guide,
  LoyaltyLedgerEntry,
  Modifier,
  Order,
  Origin,
  Reservation,
  ReservationSlot,
  ReservationType,
  Review,
  Store,
  Subscription,
  User,
} from '@/domain/types';
import { commit, db, type IdempotencyRecord } from './memory/store';
import { isPostgres } from './client';
import { catalogueSnapshot, sellableMap } from './catalogue';
import * as pg from './pg';
import type { UpdateGuard } from './pg';

export type { UpdateGuard };

/** True when connected to Postgres. */
export const usingPostgres = isPostgres;

/** Where the data actually lives, surfaced by `/api/health` and the admin page. */
export function backendName(): 'postgres' | 'in-process' {
  return usingPostgres ? 'postgres' : 'in-process';
}

/* ── Catalogue ──────────────────────────────────────────────────────── */
export async function listDrinks(): Promise<Drink[]> {
  return (await catalogueSnapshot()).drinks;
}

/** Every sellable thing by id, slug and legacy key — drinks AND pairings. */
export async function catalogueMap(): Promise<Map<string, Drink>> {
  return sellableMap();
}

export async function getDrinkBySlug(slug: string): Promise<Drink | null> {
  return (await sellableMap()).get(slug) ?? null;
}

export async function getDrinkById(id: string): Promise<Drink | null> {
  return (await sellableMap()).get(id) ?? null;
}

export async function listModifiers(): Promise<Modifier[]> {
  return MODIFIERS;
}

export async function listOrigins(): Promise<Origin[]> {
  return (await catalogueSnapshot()).origins;
}

export async function getOrigin(slug: string): Promise<Origin | null> {
  return (await listOrigins()).find((o) => o.slug === slug) ?? null;
}

export async function listStores(): Promise<Store[]> {
  return (await catalogueSnapshot()).stores.filter((s) => s.isActive);
}

/** Any room an order may point at — including one that has since closed. */
export async function getStore(idOrSlug: string): Promise<Store | null> {
  const snap = await catalogueSnapshot();
  const id = snap.storeAppId.get(idOrSlug) ?? idOrSlug;
  return snap.stores.find((s) => s.id === id || s.slug === idOrSlug) ?? null;
}

export async function listGuides(): Promise<Guide[]> {
  return GUIDES;
}

export async function getGuide(slug: string): Promise<Guide | null> {
  return GUIDES.find((g) => g.slug === slug) ?? null;
}

/** Full-text-ish search. Postgres would do this with `search_vector` + GIN (§4.3). */
export async function searchDrinks(q: string): Promise<Drink[]> {
  const drinks = await listDrinks();
  const needle = q.trim().toLowerCase();
  if (!needle) return drinks;
  const terms = needle.split(/\s+/);
  return drinks
    .map((d) => {
      const hayA = d.name.toLowerCase();
      const hayB = d.description.toLowerCase();
      const hayC = d.tastingNotes.join(' ').toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (hayA.includes(t)) score += 3; // setweight 'A'
        if (hayB.includes(t)) score += 2; // setweight 'B'
        if (hayC.includes(t)) score += 1; // setweight 'C'
      }
      return { d, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.d);
}

/* ── Orders ─────────────────────────────────────────────────────────── */
const byPlacedDesc = (a: Order, b: Order) => b.placedAt.localeCompare(a.placedAt);

export async function insertOrder(order: Omit<Order, 'orderNumber'>): Promise<Order> {
  if (usingPostgres) return pg.insertOrder(order);
  let orderNumber = mintOrderNumber();
  while (db.orders.some((o) => o.orderNumber === orderNumber)) orderNumber = mintOrderNumber();
  const row: Order = { ...order, orderNumber };
  db.orders.unshift(row);
  commit();
  return row;
}

export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  if (usingPostgres) return pg.getOrderByNumber(orderNumber);
  return db.orders.find((o) => o.orderNumber === orderNumber) ?? null;
}

/** Returns null when the order is missing or the guard does not hold. */
export async function updateOrder(
  orderNumber: string,
  patch: Partial<Order>,
  guard: UpdateGuard = {},
): Promise<Order | null> {
  if (usingPostgres) return pg.updateOrder(orderNumber, patch, guard);
  const i = db.orders.findIndex((o) => o.orderNumber === orderNumber);
  if (i === -1) return null;
  const current = db.orders[i];
  if (guard.status?.length && !guard.status.includes(current.status)) return null;
  if (guard.paymentStatus?.length && !guard.paymentStatus.includes(current.paymentStatus)) return null;
  db.orders[i] = { ...current, ...patch };
  commit();
  return db.orders[i];
}

export async function listOrders(opts: { limit?: number } = {}): Promise<Order[]> {
  if (usingPostgres) return pg.listOrders(opts);
  return [...db.orders].sort(byPlacedDesc).slice(0, opts.limit ?? 50);
}

export async function listOrdersForUser(
  userId: string,
  email: string | null,
  limit = 30,
): Promise<Order[]> {
  if (usingPostgres) return pg.listOrdersForUser(userId, email, limit);
  const mail = email?.trim().toLowerCase();
  return db.orders
    .filter((o) => o.userId === userId || (!!mail && o.guestEmail?.toLowerCase() === mail))
    .sort(byPlacedDesc)
    .slice(0, limit);
}

export async function findLatestOrderByContact(contact: string): Promise<Order | null> {
  if (usingPostgres) return pg.findLatestOrderByContact(contact);
  const value = contact.trim();
  const digits = value.replace(/\D/g, '');
  const matches = db.orders.filter((o) =>
    value.includes('@')
      ? o.guestEmail?.toLowerCase() === value.toLowerCase()
      : digits.length >= 10 && (o.guestPhone ?? '').replace(/\D/g, '').slice(-10) === digits.slice(-10),
  );
  return matches.sort(byPlacedDesc)[0] ?? null;
}

export async function listPendingUpiOrders(): Promise<Order[]> {
  if (usingPostgres) return pg.listPendingUpiOrders();
  return db.orders
    .filter(
      (o) => o.paymentMethod === 'upi' && o.paymentStatus === 'pending' && o.status === 'pending_payment',
    )
    .sort(byPlacedDesc);
}

/* ── Reservation slots — the atomic capacity check (§9.2) ───────────── */
export async function listSlots(
  storeId: string,
  slotDate: string,
  type: ReservationType = 'table',
): Promise<ReservationSlot[]> {
  if (usingPostgres) return pg.listSlots(storeId, slotDate, type);
  const snap = await catalogueSnapshot();
  const id = snap.storeAppId.get(storeId) ?? storeId;
  return db.slots
    .filter((s) => s.storeId === id && s.slotDate === slotDate && s.type === type)
    .sort((a, b) => a.slotTime.localeCompare(b.slotTime));
}

export async function listEventSlots(fromDate: string): Promise<ReservationSlot[]> {
  if (usingPostgres) return pg.listEventSlots(fromDate);
  return db.slots
    .filter((s) => s.type === 'event' && s.slotDate >= fromDate)
    .sort((a, b) => (a.slotDate + a.slotTime).localeCompare(b.slotDate + b.slotTime));
}

export async function getSlot(id: string): Promise<ReservationSlot | null> {
  if (usingPostgres) return pg.getSlot(id);
  return db.slots.find((s) => s.id === id) ?? null;
}

/**
 * ONE atomic compare-and-set. There is no `SELECT booked_count` before this,
 * anywhere in the codebase — that read-then-write gap is the entire bug this
 * prevents. Returns the remaining seats, or throws `SlotFullError`.
 */
export async function bookSlotAtomically(slotId: string, partySize: number): Promise<number> {
  if (usingPostgres) return pg.bookSlotAtomically(slotId, partySize);
  const slot = db.slots.find((s) => s.id === slotId);
  if (!slot) throw new SlotFullError(0);

  const seats = seatsConsumed(slot.type, partySize);
  const next = slot.bookedCount + seats;

  // The guard and the write are one indivisible step, matching
  // `WHERE booked_count + $seats <= capacity` in the SQL statement.
  if (next > slot.capacity) throw new SlotFullError(slot.capacity - slot.bookedCount);
  slot.bookedCount = next;
  commit();
  return slot.capacity - slot.bookedCount;
}

export async function releaseSlot(slotId: string, partySize: number): Promise<void> {
  if (usingPostgres) return pg.releaseSlot(slotId, partySize);
  const slot = db.slots.find((s) => s.id === slotId);
  if (!slot) return;
  slot.bookedCount = Math.max(0, slot.bookedCount - seatsConsumed(slot.type, partySize));
  commit();
}

function withSlotAndStore(r: Reservation, stores: Store[]): Reservation {
  const slot = db.slots.find((s) => s.id === r.slotId);
  return { ...r, slot, store: slot ? stores.find((s) => s.id === slot.storeId) : undefined };
}

export async function insertReservation(r: Reservation): Promise<Reservation> {
  if (usingPostgres) return pg.insertReservation(r);
  db.reservations.unshift(r);
  commit();
  return withSlotAndStore(r, (await catalogueSnapshot()).stores);
}

export async function getReservation(reference: string): Promise<Reservation | null> {
  if (usingPostgres) return pg.getReservation(reference);
  const r = db.reservations.find((x) => x.reference === reference);
  return r ? withSlotAndStore(r, (await catalogueSnapshot()).stores) : null;
}

export async function updateReservation(
  reference: string,
  patch: Partial<Reservation>,
): Promise<Reservation | null> {
  if (usingPostgres) return pg.updateReservation(reference, patch);
  const i = db.reservations.findIndex((x) => x.reference === reference);
  if (i === -1) return null;
  db.reservations[i] = { ...db.reservations[i], ...patch };
  commit();
  return withSlotAndStore(db.reservations[i], (await catalogueSnapshot()).stores);
}

export async function listReservations(userId?: string): Promise<Reservation[]> {
  if (usingPostgres) return pg.listReservations(userId);
  const stores = (await catalogueSnapshot()).stores;
  const rows = userId ? db.reservations.filter((r) => r.userId === userId) : db.reservations;
  return rows.map((r) => withSlotAndStore(r, stores));
}

/* ── Reviews ────────────────────────────────────────────────────────── */
export async function listReviews(drinkId: string): Promise<Review[]> {
  if (usingPostgres) return pg.listReviews(drinkId);
  return db.reviews
    .filter((r) => r.drinkId === drinkId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function insertReview(r: Review): Promise<Review> {
  if (usingPostgres) return pg.insertReview(r);
  const existing = r.userId
    ? db.reviews.findIndex((x) => x.drinkId === r.drinkId && x.userId === r.userId)
    : -1;
  if (existing !== -1) db.reviews.splice(existing, 1);
  db.reviews.unshift(r);
  commit();
  return r;
}

export async function ratingSummary(drinkId: string): Promise<{ average: number; count: number }> {
  const rows = await listReviews(drinkId);
  if (!rows.length) return { average: 0, count: 0 };
  return {
    average: rows.reduce((a, r) => a + r.rating, 0) / rows.length,
    count: rows.length,
  };
}

/* ── Users & loyalty — tier is DERIVED, never stored (§9.4) ─────────── */
export const DEMO_USER_ID = 'usr-demo';

export async function getUser(id: string): Promise<User | null> {
  if (usingPostgres) return pg.getUser(id);
  return db.users.find((u) => u.id === id) ?? null;
}

/** Called on every Google sign-in: find the guest by email or open their account. */
export async function upsertOAuthUser(input: {
  email: string;
  name?: string | null;
  image?: string | null;
}): Promise<User> {
  if (usingPostgres) return pg.upsertOAuthUser(input);
  const email = input.email.trim().toLowerCase();
  const existing = db.users.find((u) => u.email.toLowerCase() === email);
  if (existing) {
    existing.name = input.name ?? existing.name;
    existing.image = input.image ?? existing.image;
    commit();
    return existing;
  }
  const user: User = {
    id: `usr-${shortCode(10).toLowerCase()}`,
    name: input.name ?? email.split('@')[0],
    email,
    image: input.image ?? null,
    lifetimePoints: 0,
    referralCode: `AURA-${shortCode(4)}`,
    locale: 'en-IN',
    currency: 'INR',
    isAdmin: false,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  commit();
  return user;
}

export async function loyaltyFor(userId: string) {
  if (usingPostgres) return pg.loyaltyFor(userId);
  const user = await getUser(userId);
  if (!user) return null;
  // `deriveLoyalty` is called on READ. Nothing here writes a tier back.
  return { user, ...deriveLoyalty(user.lifetimePoints) };
}

export async function listLedger(userId: string): Promise<LoyaltyLedgerEntry[]> {
  if (usingPostgres) return pg.listLedger(userId);
  return db.ledger
    .filter((l) => l.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function accruePoints(
  userId: string,
  delta: number,
  reason: string,
  orderId: string | null,
): Promise<void> {
  if (usingPostgres) return pg.accruePoints(userId, delta, reason, orderId);
  const user = db.users.find((u) => u.id === userId);
  if (!user) return;
  user.lifetimePoints = Math.max(0, user.lifetimePoints + delta);
  db.ledger.unshift({
    id: `led-${Date.now().toString(36)}`,
    userId,
    orderId,
    delta,
    reason,
    createdAt: new Date().toISOString(),
  });
  commit();
}

/* ── Subscriptions ──────────────────────────────────────────────────── */
export async function listSubscriptions(userId: string): Promise<Subscription[]> {
  if (usingPostgres) return pg.listSubscriptions(userId);
  return db.subscriptions.filter((s) => s.userId === userId);
}

export async function insertSubscription(s: Subscription): Promise<Subscription> {
  if (usingPostgres) return pg.insertSubscription(s);
  db.subscriptions.unshift(s);
  commit();
  return s;
}

export async function updateSubscription(
  id: string,
  patch: Partial<Subscription>,
): Promise<Subscription | null> {
  if (usingPostgres) return pg.updateSubscription(id, patch);
  const i = db.subscriptions.findIndex((s) => s.id === id);
  if (i === -1) return null;
  db.subscriptions[i] = { ...db.subscriptions[i], ...patch };
  commit();
  return db.subscriptions[i];
}

/* ── Idempotency (§9.3) ─────────────────────────────────────────────── */
export async function claimIdempotencyKey(
  key: string,
  requestHash: string,
): Promise<{ outcome: 'claimed' | 'replay' | 'conflict' | 'in_progress'; record?: IdempotencyRecord }> {
  if (usingPostgres) return pg.claimIdempotencyKey(key, requestHash);
  const now = Date.now();
  const existing = db.idempotency[key];

  // `INSERT ... ON CONFLICT (key) DO NOTHING RETURNING *` — one statement.
  if (!existing || existing.expiresAt < now) {
    db.idempotency[key] = {
      key,
      requestHash,
      statusCode: null,
      response: null,
      state: 'in_progress',
      expiresAt: now + 24 * 3600 * 1000,
    };
    commit();
    return { outcome: 'claimed' };
  }

  // Three distinct correct outcomes, and the third is the one most
  // implementations get wrong.
  if (existing.requestHash !== requestHash) return { outcome: 'conflict' };
  if (existing.state === 'in_progress') return { outcome: 'in_progress', record: existing };
  return { outcome: 'replay', record: existing };
}

export async function completeIdempotencyKey(
  key: string,
  statusCode: number,
  response: unknown,
): Promise<void> {
  if (usingPostgres) return pg.completeIdempotencyKey(key, statusCode, response);
  const rec = db.idempotency[key];
  if (!rec) return;
  rec.statusCode = statusCode;
  rec.response = response;
  rec.state = 'completed';
  commit();
}

export async function releaseIdempotencyKey(key: string): Promise<void> {
  if (usingPostgres) return pg.releaseIdempotencyKey(key);
  delete db.idempotency[key];
  commit();
}

/* ── Rate limiting — a Postgres-native token bucket, no Redis (§6.6) ── */
function takeTokenInMemory(bucket: string, limit: number, windowMs: number) {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  db.rateLimits = db.rateLimits.filter((r) => r.windowStart >= now - windowMs * 3);

  let row = db.rateLimits.find((r) => r.bucket === bucket && r.windowStart === windowStart);
  if (!row) {
    row = { bucket, windowStart, count: 0 };
    db.rateLimits.push(row);
  }
  if (row.count >= limit) {
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((windowStart + windowMs - now) / 1000) };
  }
  row.count += 1;
  return { ok: true, remaining: limit - row.count, retryAfterSec: 0 };
}

export async function takeToken(
  bucket: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: boolean; remaining: number; retryAfterSec: number }> {
  if (usingPostgres) {
    try {
      return await pg.takeToken(bucket, limit, windowMs);
    } catch (err) {
      // A limiter outage must not take the endpoints it protects down with
      // it; this instance's own bucket still applies.
      console.warn('[rate-limit] Postgres bucket unavailable, using in-process:', err);
    }
  }
  return takeTokenInMemory(bucket, limit, windowMs);
}

/* ── Caches (§6.3, §6.4) — best effort by definition ───────────────── */
export async function getGeocodeCache(query: string) {
  if (usingPostgres) {
    try {
      return await pg.getGeocodeCache(query);
    } catch {
      /* fall through to the in-process cache */
    }
  }
  return db.geocode[query] ?? null;
}

export async function putGeocodeCache(
  query: string,
  hit: { lat: number; lng: number; displayName: string },
) {
  if (usingPostgres) {
    try {
      return await pg.putGeocodeCache(query, hit);
    } catch {
      /* fall through */
    }
  }
  db.geocode[query] = hit;
  commit();
}

export async function getWeatherCache(gridKey: string, ttlMs: number) {
  if (usingPostgres) {
    try {
      return await pg.getWeatherCache(gridKey, ttlMs);
    } catch {
      /* fall through */
    }
  }
  const row = db.weather[gridKey];
  if (!row || Date.now() - row.fetchedAt > ttlMs) return null;
  return row.payload;
}

export async function putWeatherCache(gridKey: string, payload: unknown) {
  if (usingPostgres) {
    try {
      return await pg.putWeatherCache(gridKey, payload);
    } catch {
      /* fall through */
    }
  }
  db.weather[gridKey] = { payload, fetchedAt: Date.now() };
  commit();
}

/* ── Cleanup sweep — Postgres has no TTL indexes (§4.3) ─────────────── */
export async function sweepExpired(): Promise<{ idempotency: number; rateLimits: number }> {
  if (usingPostgres) return pg.sweepExpired();
  const now = Date.now();
  const before = Object.keys(db.idempotency).length;
  for (const [k, v] of Object.entries(db.idempotency)) {
    if (v.expiresAt < now) delete db.idempotency[k];
  }
  const rlBefore = db.rateLimits.length;
  db.rateLimits = db.rateLimits.filter((r) => r.windowStart >= now - 3600_000);
  commit();
  return {
    idempotency: before - Object.keys(db.idempotency).length,
    rateLimits: rlBefore - db.rateLimits.length,
  };
}
