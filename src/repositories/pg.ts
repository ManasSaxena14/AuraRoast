/**
 * The Postgres adapter — every transactional operation, against the real
 * schema in `./schema.ts`.
 *
 * On a serverless host each request can land on a different instance, so
 * process memory is never a source of truth here: an order read back from
 * "memory" was a copy that went stale the moment another instance verified,
 * cancelled or routed it. Everything below reads and writes Postgres and
 * nothing else.
 *
 * Ids cross this boundary exactly once. Rows store UUID foreign keys; the app
 * sees the catalogue's own ids (`str-indiranagar`, `drk-cortado`), translated
 * through the maps in `./catalogue.ts`.
 */
import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { SEED_REVIEWS } from '@/data/reviews';
import { deriveLoyalty } from '@/domain/loyalty';
import { DomainError, SlotFullError } from '@/domain/errors';
import {
  BOOKING_HORIZON_DAYS,
  EVENT_STORES,
  addDays,
  seatsConsumed,
  slotSeedsFor,
  toDateKey,
  weekdayOf,
} from '@/domain/slots';
import { orderNumber as mintOrderNumber, shortCode } from '@/lib/ids';
import type {
  DeliveryPlan,
  LoyaltyLedgerEntry,
  Order,
  OrderStatus,
  PaymentStatus,
  Reservation,
  ReservationSlot,
  ReservationType,
  Review,
  RouteGeometry,
  SelectedModifier,
  Subscription,
  User,
} from '@/domain/types';
import * as schema from './schema';
import { atomic, getDb, pgErrorCode, UNIQUE_VIOLATION, type Db } from './client';
import { catalogueSnapshot, type CatalogueSnapshot } from './catalogue';
import type { IdempotencyRecord } from './memory/store';

async function db(): Promise<Db> {
  const d = await getDb();
  if (!d) throw new Error('Postgres is not configured.');
  return d;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Postgres rejects a malformed uuid with an error, not an empty result. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

function iso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

/* ── Orders ─────────────────────────────────────────────────────────── */
type OrderRow = typeof schema.orders.$inferSelect;
type ItemRow = typeof schema.orderItems.$inferSelect;

function toOrder(r: OrderRow, items: ItemRow[], snap: CatalogueSnapshot): Order {
  return {
    id: r.id,
    orderNumber: r.orderNumber,
    userId: r.userId,
    guestName: r.guestName,
    guestEmail: r.guestEmail,
    guestPhone: r.guestPhone,
    storeId: r.storeId ? (snap.storeAppId.get(r.storeId) ?? r.storeId) : null,
    fulfillment: r.fulfillment,
    addressLine: r.addressLine,
    deliveryLat: r.deliveryLat,
    deliveryLng: r.deliveryLng,
    subtotal: r.subtotal,
    tax: r.tax,
    deliveryFee: r.deliveryFee,
    tip: r.tip,
    discount: r.discount,
    total: r.total,
    currency: r.currency,
    status: r.status,
    paymentMethod: r.paymentMethod,
    paymentStatus: r.paymentStatus,
    upiTransactionRef: r.upiTransactionRef,
    verifiedAt: iso(r.verifiedAt),
    deliveryPlan: (r.deliveryPlan as DeliveryPlan | null) ?? null,
    routeGeometry: (r.routeGeometry as RouteGeometry | null) ?? null,
    routeSource: (r.routeSource as Order['routeSource']) ?? null,
    derivedStage: r.derivedStage ?? null,
    placedAt: iso(r.placedAt) ?? new Date().toISOString(),
    confirmedAt: iso(r.confirmedAt),
    cancelledAt: iso(r.cancelledAt),
    items: items.map((it) => ({
      id: it.id,
      drinkId: it.drinkId ? (snap.drinkAppId.get(it.drinkId) ?? it.drinkId) : null,
      nameSnapshot: it.nameSnapshot,
      unitPrice: it.unitPrice,
      quantity: it.quantity,
      modifiers: (it.modifiers as SelectedModifier[] | null) ?? [],
      lineTotal: it.unitPrice * it.quantity,
    })),
  };
}

/** Attach items to a page of orders in ONE query, not one per order. */
async function hydrate(rows: OrderRow[]): Promise<Order[]> {
  if (!rows.length) return [];
  const [d, snap] = await Promise.all([db(), catalogueSnapshot()]);
  const items = await d
    .select()
    .from(schema.orderItems)
    .where(inArray(schema.orderItems.orderId, rows.map((r) => r.id)));
  const byOrder = new Map<string, ItemRow[]>();
  for (const it of items) {
    const list = byOrder.get(it.orderId);
    if (list) list.push(it);
    else byOrder.set(it.orderId, [it]);
  }
  return rows.map((r) => toOrder(r, byOrder.get(r.id) ?? [], snap));
}

export async function insertOrder(order: Omit<Order, 'orderNumber'>): Promise<Order> {
  const snap = await catalogueSnapshot();
  const storeId = order.storeId
    ? (snap.storeDbId.get(order.storeId) ?? (isUuid(order.storeId) ? order.storeId : null))
    : null;

  // The unique index on order_number is the real guard; a collision (odds of
  // roughly one in a billion per pair) just draws a fresh number.
  for (let attempt = 0; ; attempt++) {
    const orderNumber = mintOrderNumber();
    try {
      // Order and items in ONE transaction: a receipt can never exist
      // without its lines, or lines without their receipt.
      await atomic((d) => [
        d.insert(schema.orders).values({
          id: order.id,
          orderNumber,
          userId: isUuid(order.userId) ? order.userId : null,
          guestName: order.guestName,
          guestEmail: order.guestEmail,
          guestPhone: order.guestPhone,
          storeId,
          fulfillment: order.fulfillment,
          addressLine: order.addressLine,
          deliveryLat: order.deliveryLat,
          deliveryLng: order.deliveryLng,
          subtotal: order.subtotal,
          tax: order.tax,
          deliveryFee: order.deliveryFee,
          tip: order.tip,
          discount: order.discount,
          total: order.total,
          currency: order.currency,
          status: order.status,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          upiTransactionRef: order.upiTransactionRef,
          deliveryPlan: order.deliveryPlan,
          routeGeometry: order.routeGeometry,
          routeSource: order.routeSource,
          derivedStage: order.derivedStage,
          placedAt: new Date(order.placedAt),
          confirmedAt: order.confirmedAt ? new Date(order.confirmedAt) : null,
          cancelledAt: order.cancelledAt ? new Date(order.cancelledAt) : null,
        }),
        ...(order.items.length
          ? [
              d.insert(schema.orderItems).values(
                order.items.map((it) => ({
                  id: it.id,
                  orderId: order.id,
                  // Pairings have no drinks row, so they carry only the snapshot.
                  drinkId: it.drinkId
                    ? (snap.drinkDbId.get(it.drinkId) ?? (isUuid(it.drinkId) ? it.drinkId : null))
                    : null,
                  nameSnapshot: it.nameSnapshot,
                  unitPrice: it.unitPrice,
                  quantity: it.quantity,
                  modifiers: it.modifiers,
                })),
              ),
            ]
          : []),
      ]);
      return { ...order, orderNumber };
    } catch (err) {
      if (pgErrorCode(err) === UNIQUE_VIOLATION && attempt < 3) continue;
      throw err;
    }
  }
}

export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  const d = await db();
  const [row] = await d
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.orderNumber, orderNumber))
    .limit(1);
  return row ? ((await hydrate([row]))[0] ?? null) : null;
}

export interface UpdateGuard {
  /** Only write if the row is currently in one of these states. */
  status?: OrderStatus[];
  paymentStatus?: PaymentStatus[];
}

/**
 * Writes every field the app ever changes after placement — including the
 * delivery plan and the route, which used to be written to process memory
 * only, so any other instance read the order back with no plan and reported
 * "Awaiting payment" for an order that had been confirmed.
 *
 * Returns null when the guard does not hold (someone else got there first).
 */
export async function updateOrder(
  orderNumber: string,
  patch: Partial<Order>,
  guard: UpdateGuard = {},
): Promise<Order | null> {
  const set: Partial<typeof schema.orders.$inferInsert> = {};
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.paymentStatus !== undefined) set.paymentStatus = patch.paymentStatus;
  if (patch.upiTransactionRef !== undefined) set.upiTransactionRef = patch.upiTransactionRef;
  if (patch.confirmedAt !== undefined) set.confirmedAt = patch.confirmedAt ? new Date(patch.confirmedAt) : null;
  if (patch.cancelledAt !== undefined) set.cancelledAt = patch.cancelledAt ? new Date(patch.cancelledAt) : null;
  if (patch.verifiedAt !== undefined) set.verifiedAt = patch.verifiedAt ? new Date(patch.verifiedAt) : null;
  if (patch.derivedStage !== undefined) set.derivedStage = patch.derivedStage;
  if (patch.deliveryPlan !== undefined) set.deliveryPlan = patch.deliveryPlan;
  if (patch.routeGeometry !== undefined) set.routeGeometry = patch.routeGeometry;
  if (patch.routeSource !== undefined) set.routeSource = patch.routeSource;
  if (patch.userId !== undefined) set.userId = isUuid(patch.userId) ? patch.userId : null;

  if (Object.keys(set).length === 0) return getOrderByNumber(orderNumber);

  const conditions = [eq(schema.orders.orderNumber, orderNumber)];
  if (guard.status?.length) conditions.push(inArray(schema.orders.status, guard.status));
  if (guard.paymentStatus?.length) {
    conditions.push(inArray(schema.orders.paymentStatus, guard.paymentStatus));
  }

  const d = await db();
  const rows = await d.update(schema.orders).set(set).where(and(...conditions)).returning();
  return rows.length ? ((await hydrate(rows))[0] ?? null) : null;
}

export async function listOrders(opts: { limit?: number } = {}): Promise<Order[]> {
  const d = await db();
  const rows = await d
    .select()
    .from(schema.orders)
    .orderBy(desc(schema.orders.placedAt))
    .limit(opts.limit ?? 50);
  return hydrate(rows);
}

/** A signed-in guest's orders: those placed signed in, and those placed with their email. */
export async function listOrdersForUser(
  userId: string,
  email: string | null,
  limit = 30,
): Promise<Order[]> {
  const d = await db();
  const byUser = isUuid(userId) ? sql`${schema.orders.userId} = ${userId}` : sql`false`;
  const byEmail = email
    ? sql`lower(${schema.orders.guestEmail}) = ${email.trim().toLowerCase()}`
    : sql`false`;
  const rows = await d
    .select()
    .from(schema.orders)
    .where(sql`(${byUser}) or (${byEmail})`)
    .orderBy(desc(schema.orders.placedAt))
    .limit(limit);
  return hydrate(rows);
}

/** The most recent order placed with this exact email, or this exact phone number. */
export async function findLatestOrderByContact(contact: string): Promise<Order | null> {
  const value = contact.trim();
  let where;
  if (value.includes('@')) {
    where = sql`lower(${schema.orders.guestEmail}) = ${value.toLowerCase()}`;
  } else {
    const digits = value.replace(/\D/g, '');
    if (digits.length < 10) return null;
    where = sql`right(regexp_replace(coalesce(${schema.orders.guestPhone}, ''), '[^0-9]', '', 'g'), 10) = ${digits.slice(-10)}`;
  }
  const d = await db();
  const rows = await d
    .select()
    .from(schema.orders)
    .where(where)
    .orderBy(desc(schema.orders.placedAt))
    .limit(1);
  return (await hydrate(rows))[0] ?? null;
}

export async function listPendingUpiOrders(): Promise<Order[]> {
  const d = await db();
  const rows = await d
    .select()
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.paymentMethod, 'upi'),
        eq(schema.orders.paymentStatus, 'pending'),
        eq(schema.orders.status, 'pending_payment'),
      ),
    )
    .orderBy(desc(schema.orders.placedAt))
    .limit(200);
  return hydrate(rows);
}

/* ── Idempotency (§9.3) ─────────────────────────────────────────────── */
function toIdemRecord(r: typeof schema.idempotencyRecords.$inferSelect): IdempotencyRecord {
  return {
    key: r.key,
    requestHash: r.requestHash,
    statusCode: r.statusCode,
    response: r.response,
    state: r.state as IdempotencyRecord['state'],
    expiresAt: r.expiresAt.getTime(),
  };
}

export async function claimIdempotencyKey(
  key: string,
  requestHash: string,
  depth = 0,
): Promise<{ outcome: 'claimed' | 'replay' | 'conflict' | 'in_progress'; record?: IdempotencyRecord }> {
  const d = await db();
  const t = schema.idempotencyRecords;

  // `INSERT ... ON CONFLICT DO NOTHING RETURNING` — one statement decides it.
  const inserted = await d
    .insert(t)
    .values({ key, requestHash, state: 'in_progress' })
    .onConflictDoNothing()
    .returning({ key: t.key });
  if (inserted.length) return { outcome: 'claimed' };

  // An expired key is taken over — atomically, so two retries cannot both win.
  const takenOver = await d
    .update(t)
    .set({
      requestHash,
      state: 'in_progress',
      statusCode: null,
      response: null,
      createdAt: sql`now()`,
      expiresAt: sql`now() + interval '24 hours'`,
    })
    .where(and(eq(t.key, key), lt(t.expiresAt, sql`now()`)))
    .returning({ key: t.key });
  if (takenOver.length) return { outcome: 'claimed' };

  const [existing] = await d.select().from(t).where(eq(t.key, key)).limit(1);
  if (!existing) {
    // Swept between the two statements — try once more from the top.
    if (depth < 2) return claimIdempotencyKey(key, requestHash, depth + 1);
    throw new DomainError('Could not reserve that order key. Try again.', 'idempotency_busy', 503);
  }
  const record = toIdemRecord(existing);
  if (existing.requestHash !== requestHash) return { outcome: 'conflict' };
  if (existing.state === 'in_progress') return { outcome: 'in_progress', record };
  return { outcome: 'replay', record };
}

export async function completeIdempotencyKey(key: string, statusCode: number, response: unknown) {
  const d = await db();
  await d
    .update(schema.idempotencyRecords)
    .set({ statusCode, response, state: 'completed' })
    .where(eq(schema.idempotencyRecords.key, key));
}

export async function releaseIdempotencyKey(key: string) {
  const d = await db();
  await d.delete(schema.idempotencyRecords).where(eq(schema.idempotencyRecords.key, key));
}

/* ── Rate limiting — a Postgres-native token bucket (§6.6) ──────────── */
export async function takeToken(bucket: string, limit: number, windowMs: number) {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const t = schema.rateLimits;
  const d = await db();
  const [row] = await d
    .insert(t)
    .values({ bucket, windowStart: new Date(windowStart), count: 1 })
    .onConflictDoUpdate({ target: [t.bucket, t.windowStart], set: { count: sql`${t.count} + 1` } })
    .returning({ count: t.count });
  const count = row?.count ?? 1;

  // Every limited request writes a row, so the table must be swept — and a
  // sweep that depends on someone remembering to schedule a cron is a table
  // that grows forever. About one request in two hundred does it inline: two
  // indexed deletes, a few milliseconds, bounded without any configuration.
  if (Math.random() < 0.005) {
    await sweepExpired().catch((err) => console.warn('[sweep] failed:', err));
  }

  if (count > limit) {
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((windowStart + windowMs - now) / 1000) };
  }
  return { ok: true, remaining: limit - count, retryAfterSec: 0 };
}

/* ── Reservation slots — the atomic capacity check (§9.2) ───────────── */
type SlotRow = typeof schema.reservationSlots.$inferSelect;

function toSlot(r: SlotRow, snap: CatalogueSnapshot): ReservationSlot {
  return {
    id: r.id,
    storeId: snap.storeAppId.get(r.storeId) ?? r.storeId,
    slotDate: String(r.slotDate).slice(0, 10),
    slotTime: String(r.slotTime).slice(0, 5),
    type: r.type,
    capacity: r.capacity,
    bookedCount: r.bookedCount,
    ...(r.eventTitle ? { eventTitle: r.eventTitle } : {}),
    ...(r.eventPrice != null ? { eventPrice: r.eventPrice } : {}),
  };
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Only days the booking window actually offers — the API cannot conjure rows for 2099. */
function inWindow(dateKey: string): boolean {
  if (!DATE_KEY.test(dateKey)) return false;
  const today = toDateKey();
  return dateKey >= today && dateKey <= addDays(today, BOOKING_HORIZON_DAYS - 1);
}

// Per instance: which (room, day) grids are known to exist. Losing this on a
// cold start costs one idempotent INSERT, never a duplicate slot.
const ensured = new Set<string>();

/**
 * Slots are written lazily, the first time a day is looked at, from the same
 * generator the in-process adapter uses. There is no cron to forget to run and
 * the calendar rolls forward on its own. The unique (store, date, time, type)
 * index makes a concurrent first look harmless.
 */
async function ensureSlots(storeAppId: string, dateKey: string): Promise<void> {
  const key = `${storeAppId}|${dateKey}`;
  if (ensured.has(key) || !inWindow(dateKey)) return;
  const snap = await catalogueSnapshot();
  const store = snap.stores.find((s) => s.id === storeAppId);
  const storeDbId = snap.storeDbId.get(storeAppId);
  if (!store || !storeDbId) return;
  const d = await db();
  await d
    .insert(schema.reservationSlots)
    .values(
      slotSeedsFor(store.slug, dateKey).map((s) => ({
        storeId: storeDbId,
        slotDate: s.slotDate,
        slotTime: s.slotTime,
        type: s.type,
        capacity: s.capacity,
        eventTitle: s.eventTitle ?? null,
        eventPrice: s.eventPrice ?? null,
      })),
    )
    .onConflictDoNothing();
  ensured.add(key);
}

export async function listSlots(
  storeId: string,
  slotDate: string,
  type: ReservationType = 'table',
): Promise<ReservationSlot[]> {
  if (!inWindow(slotDate)) return [];
  const snap = await catalogueSnapshot();
  const storeAppId = snap.storeAppId.get(storeId) ?? storeId;
  const storeDbId = snap.storeDbId.get(storeAppId) ?? (isUuid(storeId) ? storeId : null);
  if (!storeDbId) return [];
  const d = await db();
  const read = () =>
    d
      .select()
      .from(schema.reservationSlots)
      .where(
        and(
          eq(schema.reservationSlots.storeId, storeDbId),
          eq(schema.reservationSlots.slotDate, slotDate),
          eq(schema.reservationSlots.type, type),
        ),
      )
      .orderBy(schema.reservationSlots.slotTime);

  await ensureSlots(storeAppId, slotDate);
  let rows = await read();
  if (!rows.length && type === 'table') {
    // Every open day has tables, so an empty one means the rows went away
    // under this instance (deleted in the database) — write them again.
    ensured.delete(`${storeAppId}|${slotDate}`);
    await ensureSlots(storeAppId, slotDate);
    rows = await read();
  }
  return rows.map((r) => toSlot(r, snap));
}

export async function listEventSlots(fromDate: string): Promise<ReservationSlot[]> {
  const snap = await catalogueSnapshot();
  const cupping = snap.stores.find((s) => s.slug === EVENT_STORES.cupping);
  const brewClass = snap.stores.find((s) => s.slug === EVENT_STORES.brewClass);
  const today = toDateKey();
  await Promise.all(
    Array.from({ length: 14 }, (_, i) => addDays(today, i)).flatMap((day) => {
      const dow = weekdayOf(day);
      if (dow === 6 && cupping) return [ensureSlots(cupping.id, day)];
      if (dow === 3 && brewClass) return [ensureSlots(brewClass.id, day)];
      return [];
    }),
  );
  const d = await db();
  const rows = await d
    .select()
    .from(schema.reservationSlots)
    .where(
      and(
        eq(schema.reservationSlots.type, 'event'),
        gte(schema.reservationSlots.slotDate, fromDate),
      ),
    )
    .orderBy(schema.reservationSlots.slotDate, schema.reservationSlots.slotTime)
    .limit(20);
  return rows.map((r) => toSlot(r, snap));
}

export async function getSlot(id: string): Promise<ReservationSlot | null> {
  if (!isUuid(id)) return null;
  const [d, snap] = await Promise.all([db(), catalogueSnapshot()]);
  const [row] = await d
    .select()
    .from(schema.reservationSlots)
    .where(eq(schema.reservationSlots.id, id))
    .limit(1);
  return row ? toSlot(row, snap) : null;
}

/**
 * The whole race, in one statement:
 *
 *   UPDATE reservation_slots SET booked_count = booked_count + $seats
 *    WHERE id = $id AND booked_count + $seats <= capacity
 *   RETURNING capacity - booked_count
 *
 * No SELECT first, anywhere. Zero rows affected means the seats were not
 * there, and the `never_overbooked` CHECK backs it up at the table level.
 */
export async function bookSlotAtomically(slotId: string, partySize: number): Promise<number> {
  if (!isUuid(slotId)) throw new SlotFullError(0);
  const t = schema.reservationSlots;
  const seats = seatsConsumed('table', partySize);
  const d = await db();
  const rows = await d
    .update(t)
    .set({ bookedCount: sql`${t.bookedCount} + ${seats}` })
    .where(and(eq(t.id, slotId), sql`${t.bookedCount} + ${seats} <= ${t.capacity}`))
    .returning({ capacity: t.capacity, bookedCount: t.bookedCount });
  if (!rows.length) {
    const slot = await getSlot(slotId);
    throw new SlotFullError(slot ? Math.max(0, slot.capacity - slot.bookedCount) : 0);
  }
  return rows[0].capacity - rows[0].bookedCount;
}

export async function releaseSlot(slotId: string, partySize: number): Promise<void> {
  if (!isUuid(slotId)) return;
  const t = schema.reservationSlots;
  const d = await db();
  await d
    .update(t)
    .set({ bookedCount: sql`greatest(0, ${t.bookedCount} - ${seatsConsumed('table', partySize)})` })
    .where(eq(t.id, slotId));
}

type ReservationRow = typeof schema.reservations.$inferSelect;

function toReservation(r: ReservationRow, slot: SlotRow | null, snap: CatalogueSnapshot): Reservation {
  const mapped = slot ? toSlot(slot, snap) : undefined;
  return {
    id: r.id,
    reference: r.reference,
    slotId: r.slotId,
    userId: r.userId,
    guestName: r.guestName,
    guestEmail: r.guestEmail,
    guestPhone: r.guestPhone,
    partySize: r.partySize,
    notes: r.notes,
    status: r.status,
    createdAt: iso(r.createdAt) ?? new Date().toISOString(),
    slot: mapped,
    store: mapped ? snap.stores.find((s) => s.id === mapped.storeId) : undefined,
  };
}

export async function insertReservation(r: Reservation): Promise<Reservation> {
  const d = await db();
  await d.insert(schema.reservations).values({
    id: r.id,
    reference: r.reference,
    slotId: r.slotId,
    userId: isUuid(r.userId) ? r.userId : null,
    guestName: r.guestName,
    guestEmail: r.guestEmail,
    guestPhone: r.guestPhone,
    partySize: r.partySize,
    notes: r.notes,
    status: r.status,
    createdAt: new Date(r.createdAt),
  });
  return (await getReservation(r.reference)) ?? r;
}

async function reservationsWhere(where: ReturnType<typeof eq> | undefined, limit: number) {
  const [d, snap] = await Promise.all([db(), catalogueSnapshot()]);
  const base = d
    .select({ r: schema.reservations, s: schema.reservationSlots })
    .from(schema.reservations)
    .leftJoin(schema.reservationSlots, eq(schema.reservations.slotId, schema.reservationSlots.id));
  const rows = await (where ? base.where(where) : base)
    .orderBy(desc(schema.reservations.createdAt))
    .limit(limit);
  return rows.map(({ r, s }) => toReservation(r, s, snap));
}

export async function getReservation(reference: string): Promise<Reservation | null> {
  const [row] = await reservationsWhere(eq(schema.reservations.reference, reference), 1);
  return row ?? null;
}

export async function updateReservation(
  reference: string,
  patch: Partial<Reservation>,
): Promise<Reservation | null> {
  const set: Partial<typeof schema.reservations.$inferInsert> = {};
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.notes !== undefined) set.notes = patch.notes;
  if (Object.keys(set).length) {
    const d = await db();
    await d.update(schema.reservations).set(set).where(eq(schema.reservations.reference, reference));
  }
  return getReservation(reference);
}

export async function listReservations(userId?: string): Promise<Reservation[]> {
  if (userId !== undefined && !isUuid(userId)) return [];
  return reservationsWhere(userId ? eq(schema.reservations.userId, userId) : undefined, 200);
}

/* ── Reviews ────────────────────────────────────────────────────────── */
export async function listReviews(drinkId: string): Promise<Review[]> {
  const snap = await catalogueSnapshot();
  const dbId = snap.drinkDbId.get(drinkId) ?? (isUuid(drinkId) ? drinkId : null);
  const appId = snap.drinkAppId.get(drinkId) ?? drinkId;
  const stored: Review[] = [];
  if (dbId) {
    const d = await db();
    const rows = await d
      .select()
      .from(schema.reviews)
      .where(eq(schema.reviews.drinkId, dbId))
      .orderBy(desc(schema.reviews.createdAt))
      .limit(200);
    for (const r of rows) {
      stored.push({
        id: r.id,
        drinkId: appId,
        userId: r.userId,
        author: r.author,
        rating: r.rating,
        body: r.body ?? '',
        createdAt: iso(r.createdAt) ?? new Date().toISOString(),
      });
    }
  }
  // The launch reviews ship with the catalogue, like the drinks themselves.
  const seeded = SEED_REVIEWS.filter((r) => r.drinkId === appId);
  return [...stored, ...seeded].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function insertReview(review: Review): Promise<Review> {
  const snap = await catalogueSnapshot();
  const dbId = snap.drinkDbId.get(review.drinkId) ?? (isUuid(review.drinkId) ? review.drinkId : null);
  if (!dbId) throw new DomainError('That item cannot be reviewed.', 'not_reviewable', 400);
  const t = schema.reviews;
  const d = await db();
  const values = {
    drinkId: dbId,
    userId: isUuid(review.userId) ? review.userId : null,
    author: review.author,
    rating: review.rating,
    body: review.body,
    createdAt: new Date(review.createdAt),
  };
  // A signed-in guest has ONE review per drink (the unique index); writing
  // again edits it. Anonymous reviews have a NULL user and never collide.
  const [row] = values.userId
    ? await d
        .insert(t)
        .values(values)
        .onConflictDoUpdate({
          target: [t.drinkId, t.userId],
          set: { author: values.author, rating: values.rating, body: values.body, createdAt: values.createdAt },
        })
        .returning()
    : await d.insert(t).values(values).returning();
  return { ...review, id: row.id, drinkId: snap.drinkAppId.get(row.drinkId) ?? review.drinkId };
}

/* ── Users & loyalty — tier is DERIVED, never stored (§9.4) ─────────── */
type UserRow = typeof schema.users.$inferSelect;

function toUser(r: UserRow): User {
  return {
    id: r.id,
    name: r.name ?? r.email.split('@')[0],
    email: r.email,
    image: r.image,
    lifetimePoints: r.lifetimePoints,
    referralCode: r.referralCode ?? '',
    locale: r.locale,
    currency: r.currency,
    isAdmin: r.isAdmin,
    createdAt: iso(r.createdAt) ?? new Date().toISOString(),
  };
}

export async function getUser(id: string): Promise<User | null> {
  if (!isUuid(id)) return null;
  const d = await db();
  const [row] = await d.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  return row ? toUser(row) : null;
}

/** Called once per Google sign-in: find the guest by email, or open their account. */
export async function upsertOAuthUser(input: {
  email: string;
  name?: string | null;
  image?: string | null;
}): Promise<User> {
  const t = schema.users;
  const d = await db();
  for (let attempt = 0; ; attempt++) {
    try {
      const [row] = await d
        .insert(t)
        .values({
          email: input.email.trim().toLowerCase(),
          name: input.name ?? null,
          image: input.image ?? null,
          referralCode: `AURA-${shortCode(attempt < 2 ? 4 : 6)}`,
        })
        .onConflictDoUpdate({
          target: t.email,
          set: {
            name: sql`coalesce(excluded.name, ${t.name})`,
            image: sql`coalesce(excluded.image, ${t.image})`,
          },
        })
        .returning();
      return toUser(row);
    } catch (err) {
      // The only other unique column is the referral code: draw another.
      if (pgErrorCode(err) === UNIQUE_VIOLATION && attempt < 4) continue;
      throw err;
    }
  }
}

export async function loyaltyFor(userId: string) {
  const user = await getUser(userId);
  if (!user) return null;
  return { user, ...deriveLoyalty(user.lifetimePoints) };
}

export async function listLedger(userId: string): Promise<LoyaltyLedgerEntry[]> {
  if (!isUuid(userId)) return [];
  const d = await db();
  const rows = await d
    .select()
    .from(schema.loyaltyLedger)
    .where(eq(schema.loyaltyLedger.userId, userId))
    .orderBy(desc(schema.loyaltyLedger.createdAt))
    .limit(50);
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    orderId: r.orderId,
    delta: r.delta,
    reason: r.reason,
    createdAt: iso(r.createdAt) ?? new Date().toISOString(),
  }));
}

export async function accruePoints(
  userId: string,
  delta: number,
  reason: string,
  orderId: string | null,
): Promise<void> {
  if (!isUuid(userId) || !delta) return;
  // The balance and its ledger line move together or not at all.
  await atomic((d) => [
    d
      .update(schema.users)
      .set({ lifetimePoints: sql`greatest(0, ${schema.users.lifetimePoints} + ${delta})` })
      .where(eq(schema.users.id, userId)),
    d.insert(schema.loyaltyLedger).values({
      userId,
      orderId: isUuid(orderId) ? orderId : null,
      delta,
      reason,
    }),
  ]);
}

/* ── Subscriptions ──────────────────────────────────────────────────── */
type SubscriptionRow = typeof schema.subscriptions.$inferSelect;

function toSubscription(r: SubscriptionRow, snap: CatalogueSnapshot): Subscription {
  return {
    id: r.id,
    userId: r.userId,
    drinkId: r.drinkId ? (snap.drinkAppId.get(r.drinkId) ?? r.drinkId) : null,
    cadence: r.cadence,
    quantity: r.quantity,
    nextDelivery: String(r.nextDelivery).slice(0, 10),
    status: r.status,
    createdAt: iso(r.createdAt) ?? new Date().toISOString(),
  };
}

export async function listSubscriptions(userId: string): Promise<Subscription[]> {
  if (!isUuid(userId)) return [];
  const [d, snap] = await Promise.all([db(), catalogueSnapshot()]);
  const rows = await d
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, userId))
    .orderBy(desc(schema.subscriptions.createdAt));
  return rows.map((r) => toSubscription(r, snap));
}

export async function insertSubscription(s: Subscription): Promise<Subscription> {
  if (!isUuid(s.userId)) throw new DomainError('Sign in to subscribe.', 'auth_required', 401);
  const [d, snap] = await Promise.all([db(), catalogueSnapshot()]);
  const [row] = await d
    .insert(schema.subscriptions)
    .values({
      id: s.id,
      userId: s.userId,
      drinkId: s.drinkId ? (snap.drinkDbId.get(s.drinkId) ?? (isUuid(s.drinkId) ? s.drinkId : null)) : null,
      cadence: s.cadence,
      quantity: s.quantity,
      nextDelivery: s.nextDelivery,
      status: s.status,
      createdAt: new Date(s.createdAt),
    })
    .returning();
  return toSubscription(row, snap);
}

export async function updateSubscription(
  id: string,
  patch: Partial<Subscription>,
): Promise<Subscription | null> {
  if (!isUuid(id)) return null;
  const set: Partial<typeof schema.subscriptions.$inferInsert> = {};
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.nextDelivery !== undefined) set.nextDelivery = patch.nextDelivery;
  if (patch.quantity !== undefined) set.quantity = patch.quantity;
  if (patch.cadence !== undefined) set.cadence = patch.cadence;
  const [d, snap] = await Promise.all([db(), catalogueSnapshot()]);
  if (!Object.keys(set).length) {
    const [row] = await d.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, id)).limit(1);
    return row ? toSubscription(row, snap) : null;
  }
  const [row] = await d
    .update(schema.subscriptions)
    .set(set)
    .where(eq(schema.subscriptions.id, id))
    .returning();
  return row ? toSubscription(row, snap) : null;
}

/* ── Caches (§6.3, §6.4) ────────────────────────────────────────────── */
export async function getGeocodeCache(query: string) {
  const d = await db();
  const [row] = await d
    .select()
    .from(schema.geocodeCache)
    .where(eq(schema.geocodeCache.query, query))
    .limit(1);
  return row ? { lat: row.lat, lng: row.lng, displayName: row.displayName ?? '' } : null;
}

export async function putGeocodeCache(query: string, hit: { lat: number; lng: number; displayName: string }) {
  const d = await db();
  await d
    .insert(schema.geocodeCache)
    .values({ query, lat: hit.lat, lng: hit.lng, displayName: hit.displayName })
    .onConflictDoNothing();
}

export async function getWeatherCache(gridKey: string, ttlMs: number) {
  const d = await db();
  const [row] = await d
    .select()
    .from(schema.weatherCache)
    .where(
      and(
        eq(schema.weatherCache.gridKey, gridKey),
        gte(schema.weatherCache.fetchedAt, new Date(Date.now() - ttlMs)),
      ),
    )
    .limit(1);
  return row?.payload ?? null;
}

export async function putWeatherCache(gridKey: string, payload: unknown) {
  const t = schema.weatherCache;
  const d = await db();
  await d
    .insert(t)
    .values({ gridKey, payload, fetchedAt: new Date() })
    .onConflictDoUpdate({ target: t.gridKey, set: { payload, fetchedAt: new Date() } });
}

/* ── Cleanup sweep — Postgres has no TTL indexes (§4.3) ─────────────── */
export async function sweepExpired(): Promise<{ idempotency: number; rateLimits: number }> {
  const d = await db();
  const [idem, limits] = await Promise.all([
    d
      .delete(schema.idempotencyRecords)
      .where(lt(schema.idempotencyRecords.expiresAt, sql`now()`))
      .returning({ key: schema.idempotencyRecords.key }),
    d
      .delete(schema.rateLimits)
      .where(lt(schema.rateLimits.windowStart, sql`now() - interval '1 hour'`))
      .returning({ bucket: schema.rateLimits.bucket }),
  ]);
  return { idempotency: idem.length, rateLimits: limits.length };
}
