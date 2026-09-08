/**
 * The repository API. Services depend on THIS, never on a driver.
 *
 * Every export below reads and writes the in-process adapter
 * (`./memory/store.ts`). The Neon/Drizzle path is schema-only so far
 * (`./schema.ts`, no query layer), so `DATABASE_URL` selects nothing yet.
 *
 * It honours the three correctness rules from Part 9. The atomic
 * capacity check below is the in-process equivalent of:
 *
 *   UPDATE reservation_slots
 *      SET booked_count = booked_count + $seats
 *    WHERE id = $id AND booked_count + $seats <= capacity
 *   RETURNING capacity - booked_count AS remaining;
 *
 * — one statement, no read-then-write, zero rows affected when it is full.
 */
import { deriveLoyalty } from '@/domain/loyalty';
import { SlotFullError } from '@/domain/errors';
import { seatsConsumed } from '@/domain/slots';
import type {
  Drink,
  Guide,
  LoyaltyLedgerEntry,
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
import { catalogue, commit, db, nextOrderNumber, type IdempotencyRecord } from './memory/store';

/** False until a Drizzle query layer exists — `DATABASE_URL` alone wires nothing. */
export const usingPostgres = false;

if (process.env.DATABASE_URL) {
  // Otherwise a deploy with a real Neon URL looks healthy while every order,
  // reservation and idempotency record lands in the ephemeral store and dies
  // with the instance.
  console.warn(
    '[repositories] DATABASE_URL is set but unused — no Postgres query layer exists; ' +
      'all data is going to the in-process store and will not survive a restart.',
  );
}

/**
 * Where the data actually lives, surfaced by `/api/health` and the admin page.
 * It must follow the code path, not the env var: reporting `postgres-neon`
 * off `DATABASE_URL` alone is the one lie the health check exists to catch.
 */
export function backendName(): 'postgres-neon' | 'in-process' {
  return 'in-process';
}

/* ── Catalogue ──────────────────────────────────────────────────────── */
export async function listDrinks(): Promise<Drink[]> {
  return [...catalogue.drinks].sort((a, b) => a.sortOrder - b.sortOrder);
}
export async function getDrinkBySlug(slug: string): Promise<Drink | null> {
  return catalogue.drinks.find((d) => d.slug === slug) ?? null;
}
export async function getDrinkById(id: string): Promise<Drink | null> {
  return catalogue.drinks.find((d) => d.id === id) ?? null;
}
export async function catalogueMap(): Promise<Map<string, Drink>> {
  return new Map(catalogue.drinks.map((d) => [d.id, d]));
}
export async function listModifiers() {
  return catalogue.modifiers;
}
export async function listOrigins(): Promise<Origin[]> {
  return catalogue.origins;
}
export async function getOrigin(slug: string): Promise<Origin | null> {
  return catalogue.origins.find((o) => o.slug === slug) ?? null;
}
export async function listStores(): Promise<Store[]> {
  return catalogue.stores.filter((s) => s.isActive);
}
export async function getStore(idOrSlug: string): Promise<Store | null> {
  return catalogue.stores.find((s) => s.id === idOrSlug || s.slug === idOrSlug) ?? null;
}
export async function listGuides(): Promise<Guide[]> {
  return catalogue.guides;
}
export async function getGuide(slug: string): Promise<Guide | null> {
  return catalogue.guides.find((g) => g.slug === slug) ?? null;
}

/** Full-text-ish search. Postgres does this with `search_vector` + GIN (§4.3). */
export async function searchDrinks(q: string): Promise<Drink[]> {
  const needle = q.trim().toLowerCase();
  if (!needle) return listDrinks();
  const terms = needle.split(/\s+/);
  return catalogue.drinks
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
export async function insertOrder(order: Omit<Order, 'orderNumber'> & { orderNumber?: string }): Promise<Order> {
  const row: Order = { ...order, orderNumber: order.orderNumber ?? nextOrderNumber() } as Order;
  db.orders.unshift(row);
  commit();
  return row;
}

export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  return db.orders.find((o) => o.orderNumber === orderNumber) ?? null;
}

export async function updateOrder(orderNumber: string, patch: Partial<Order>): Promise<Order | null> {
  const i = db.orders.findIndex((o) => o.orderNumber === orderNumber);
  if (i === -1) return null;
  db.orders[i] = { ...db.orders[i], ...patch };
  commit();
  return db.orders[i];
}

export async function listOrders(opts: { userId?: string; limit?: number } = {}): Promise<Order[]> {
  let rows = db.orders;
  if (opts.userId) rows = rows.filter((o) => o.userId === opts.userId);
  return rows.slice(0, opts.limit ?? 50);
}

/** Backed by the partial index `idx_orders_pending_upi` (§4.3). */
export async function listPendingUpiOrders(): Promise<Order[]> {
  return db.orders
    .filter((o) => o.paymentMethod === 'upi' && o.paymentStatus === 'pending')
    .sort((a, b) => b.placedAt.localeCompare(a.placedAt));
}

/* ── Reservation slots — the atomic capacity check (§9.2) ───────────── */
export async function listSlots(
  storeId: string,
  slotDate: string,
  type: ReservationType = 'table',
): Promise<ReservationSlot[]> {
  return db.slots
    .filter((s) => s.storeId === storeId && s.slotDate === slotDate && s.type === type)
    .sort((a, b) => a.slotTime.localeCompare(b.slotTime));
}

export async function listEventSlots(fromDate: string): Promise<ReservationSlot[]> {
  return db.slots
    .filter((s) => s.type === 'event' && s.slotDate >= fromDate)
    .sort((a, b) => (a.slotDate + a.slotTime).localeCompare(b.slotDate + b.slotTime));
}

export async function getSlot(id: string): Promise<ReservationSlot | null> {
  return db.slots.find((s) => s.id === id) ?? null;
}

/**
 * ONE atomic compare-and-set. There is no `SELECT booked_count` before this,
 * anywhere in the codebase — that read-then-write gap is the entire bug this
 * prevents. Returns the remaining seats, or throws `SlotFullError`.
 */
export async function bookSlotAtomically(slotId: string, partySize: number): Promise<number> {
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
  const slot = db.slots.find((s) => s.id === slotId);
  if (!slot) return;
  slot.bookedCount = Math.max(0, slot.bookedCount - seatsConsumed(slot.type, partySize));
  commit();
}

export async function insertReservation(r: Reservation): Promise<Reservation> {
  db.reservations.unshift(r);
  commit();
  return r;
}

export async function getReservation(reference: string): Promise<Reservation | null> {
  const r = db.reservations.find((x) => x.reference === reference);
  if (!r) return null;
  const slot = db.slots.find((s) => s.id === r.slotId);
  const store = slot ? catalogue.stores.find((s) => s.id === slot.storeId) : undefined;
  return { ...r, slot, store };
}

export async function updateReservation(
  reference: string,
  patch: Partial<Reservation>,
): Promise<Reservation | null> {
  const i = db.reservations.findIndex((x) => x.reference === reference);
  if (i === -1) return null;
  db.reservations[i] = { ...db.reservations[i], ...patch };
  commit();
  return db.reservations[i];
}

export async function listReservations(userId?: string): Promise<Reservation[]> {
  const rows = userId ? db.reservations.filter((r) => r.userId === userId) : db.reservations;
  return rows.map((r) => {
    const slot = db.slots.find((s) => s.id === r.slotId);
    return { ...r, slot, store: slot ? catalogue.stores.find((s) => s.id === slot.storeId) : undefined };
  });
}

/* ── Reviews ────────────────────────────────────────────────────────── */
export async function listReviews(drinkId: string): Promise<Review[]> {
  return db.reviews
    .filter((r) => r.drinkId === drinkId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function insertReview(r: Review): Promise<Review> {
  db.reviews.unshift(r);
  commit();
  return r;
}
export async function ratingSummary(drinkId: string): Promise<{ average: number; count: number }> {
  const rows = db.reviews.filter((r) => r.drinkId === drinkId);
  if (!rows.length) return { average: 0, count: 0 };
  return {
    average: rows.reduce((a, r) => a + r.rating, 0) / rows.length,
    count: rows.length,
  };
}

/* ── Users & loyalty — tier is DERIVED, never stored (§9.4) ─────────── */
export async function getUser(id: string): Promise<User | null> {
  return db.users.find((u) => u.id === id) ?? null;
}
export const DEMO_USER_ID = 'usr-demo';

export async function loyaltyFor(userId: string) {
  const user = await getUser(userId);
  if (!user) return null;
  // `deriveLoyalty` is called on READ. Nothing here writes a tier back.
  return { user, ...deriveLoyalty(user.lifetimePoints) };
}

export async function listLedger(userId: string): Promise<LoyaltyLedgerEntry[]> {
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
  return db.subscriptions.filter((s) => s.userId === userId);
}
export async function insertSubscription(s: Subscription): Promise<Subscription> {
  db.subscriptions.unshift(s);
  commit();
  return s;
}
export async function updateSubscription(
  id: string,
  patch: Partial<Subscription>,
): Promise<Subscription | null> {
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
  const rec = db.idempotency[key];
  if (!rec) return;
  rec.statusCode = statusCode;
  rec.response = response;
  rec.state = 'completed';
  commit();
}

export async function releaseIdempotencyKey(key: string): Promise<void> {
  delete db.idempotency[key];
  commit();
}

/* ── Rate limiting — a Postgres-native token bucket, no Redis (§6.6) ── */
export async function takeToken(
  bucket: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: boolean; remaining: number; retryAfterSec: number }> {
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

/* ── Caches (§6.3, §6.4) ────────────────────────────────────────────── */
export async function getGeocodeCache(query: string) {
  return db.geocode[query] ?? null;
}
export async function putGeocodeCache(
  query: string,
  hit: { lat: number; lng: number; displayName: string },
) {
  db.geocode[query] = hit;
  commit();
}
export async function getWeatherCache(gridKey: string, ttlMs: number) {
  const row = db.weather[gridKey];
  if (!row || Date.now() - row.fetchedAt > ttlMs) return null;
  return row.payload;
}
export async function putWeatherCache(gridKey: string, payload: unknown) {
  db.weather[gridKey] = { payload, fetchedAt: Date.now() };
  commit();
}

/* ── Chat sessions ──────────────────────────────────────────────────── */
export async function getChat(sessionKey: string) {
  return db.chat[sessionKey]?.messages ?? [];
}
export async function putChat(sessionKey: string, messages: unknown[]) {
  db.chat[sessionKey] = { messages: messages.slice(-40), updatedAt: Date.now() };
  commit();
}

/* ── Cleanup sweep — Postgres has no TTL indexes (§4.3) ─────────────── */
export async function sweepExpired(): Promise<{ idempotency: number; rateLimits: number }> {
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
