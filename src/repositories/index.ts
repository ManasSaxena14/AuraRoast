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
import { isPostgres as pgActive, getDb } from './client';

/** True when connected to Neon via Drizzle */
export const usingPostgres = pgActive;

/**
 * Where the data actually lives, surfaced by `/api/health` and the admin page.
 */
export function backendName(): 'postgres-neon' | 'in-process' {
  return usingPostgres ? 'postgres-neon' : 'in-process';
}

import { eq } from 'drizzle-orm';
import * as schema from './schema';

/* ── Catalogue ──────────────────────────────────────────────────────── */
export async function listDrinks(): Promise<Drink[]> {
  const dbClient = await getDb();
  if (dbClient) {
    try {
      const rows = await dbClient.select().from(schema.drinks).orderBy(schema.drinks.sortOrder);
      if (rows.length > 0) {
        return rows.map((r) => {
          const match = catalogue.drinks.find((d) => d.slug === r.slug);
          return {
            id: r.id,
            slug: r.slug,
            name: r.name,
            category: r.category,
            originId: r.originId ?? match?.originId ?? null,
            roast: (r.roast as any) ?? match?.roast ?? null,
            description: r.description,
            longDescription: r.longDescription ?? match?.longDescription ?? '',
            tastingNotes: r.tastingNotes ?? match?.tastingNotes ?? [],
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
    } catch (err) {
      console.warn('[repositories] Neon listDrinks error, using fallback:', err);
    }
  }
  return [...catalogue.drinks].sort((a, b) => a.sortOrder - b.sortOrder);
}
export async function getDrinkBySlug(slug: string): Promise<Drink | null> {
  const map = await catalogueMap();
  return map.get(slug) ?? null;
}
export async function getDrinkById(id: string): Promise<Drink | null> {
  const map = await catalogueMap();
  return map.get(id) ?? null;
}
export async function catalogueMap(): Promise<Map<string, Drink>> {
  const { PAIRINGS } = await import('@/data/pairings');
  const drinks = await listDrinks();
  const map = new Map<string, Drink>();
  for (const d of drinks) {
    map.set(d.id, d);
    map.set(d.slug, d);
  }
  for (const p of PAIRINGS) {
    const item: Drink = {
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
    map.set(p.id, item);
    map.set(p.slug, item);
    map.set(`pairing-${p.id}`, item);
  }
  return map;
}
export async function listModifiers() {
  return catalogue.modifiers;
}
export async function listOrigins(): Promise<Origin[]> {
  const dbClient = await getDb();
  if (dbClient) {
    try {
      const rows = await dbClient.select().from(schema.origins);
      if (rows.length > 0) {
        return rows.map((r) => {
          const match = catalogue.origins.find((o) => o.slug === r.slug);
          return {
            id: r.id,
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
    } catch (err) {
      console.warn('[repositories] Neon listOrigins error, using fallback:', err);
    }
  }
  return catalogue.origins;
}
export async function getOrigin(slug: string): Promise<Origin | null> {
  const origins = await listOrigins();
  return origins.find((o) => o.slug === slug) ?? null;
}
export async function listStores(): Promise<Store[]> {
  const dbClient = await getDb();
  if (dbClient) {
    try {
      const rows = await dbClient.select().from(schema.stores).where(eq(schema.stores.isActive, true));
      if (rows.length > 0) {
        return rows.map((r) => {
          const match = catalogue.stores.find((s) => s.slug === r.slug);
          return {
            id: r.id,
            slug: r.slug,
            name: r.name,
            address: r.address,
            city: r.city,
            lat: r.lat,
            lng: r.lng,
            phone: r.phone ?? match?.phone ?? '',
            hours: (r.hours as Record<string, [string, string]>) ?? match?.hours ?? {},
            isActive: r.isActive,
            blurb: r.blurb ?? match?.blurb ?? '',
          };
        });
      }
    } catch (err) {
      console.warn('[repositories] Neon listStores error, using fallback:', err);
    }
  }
  return catalogue.stores.filter((s) => s.isActive);
}
export async function getStore(idOrSlug: string): Promise<Store | null> {
  const stores = await listStores();
  return stores.find((s) => s.id === idOrSlug || s.slug === idOrSlug) ?? null;
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

function safeUuid(val: string | null | undefined): string | null {
  if (!val) return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(val) ? val : null;
}

/* ── Orders ─────────────────────────────────────────────────────────── */
export async function insertOrder(order: Omit<Order, 'orderNumber'> & { orderNumber?: string }): Promise<Order> {
  const row: Order = { ...order, orderNumber: order.orderNumber ?? nextOrderNumber() } as Order;
  db.orders.unshift(row);
  commit();

  const dbClient = await getDb();
  if (dbClient) {
    try {
      await dbClient
        .insert(schema.orders)
        .values({
          id: row.id,
          orderNumber: row.orderNumber,
          userId: safeUuid(row.userId),
          guestName: row.guestName,
          guestEmail: row.guestEmail,
          guestPhone: row.guestPhone,
          storeId: safeUuid(row.storeId),
          fulfillment: row.fulfillment,
          addressLine: row.addressLine,
          deliveryLat: row.deliveryLat,
          deliveryLng: row.deliveryLng,
          subtotal: row.subtotal,
          tax: row.tax,
          deliveryFee: row.deliveryFee,
          tip: row.tip,
          discount: row.discount,
          total: row.total,
          currency: row.currency,
          status: row.status as any,
          paymentMethod: row.paymentMethod as any,
          paymentStatus: row.paymentStatus as any,
          upiTransactionRef: row.upiTransactionRef,
          deliveryPlan: row.deliveryPlan as any,
          routeGeometry: row.routeGeometry as any,
          routeSource: row.routeSource,
          derivedStage: row.derivedStage as any,
          placedAt: new Date(row.placedAt),
          confirmedAt: row.confirmedAt ? new Date(row.confirmedAt) : null,
          cancelledAt: row.cancelledAt ? new Date(row.cancelledAt) : null,
        })
        .onConflictDoUpdate({
          target: schema.orders.orderNumber,
          set: {
            status: row.status as any,
            paymentStatus: row.paymentStatus as any,
            upiTransactionRef: row.upiTransactionRef,
          },
        });

      if (row.items && row.items.length > 0) {
        for (const item of row.items) {
          await dbClient
            .insert(schema.orderItems)
            .values({
              id: item.id,
              orderId: row.id,
              drinkId: safeUuid(item.drinkId),
              nameSnapshot: item.nameSnapshot,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              modifiers: item.modifiers as any,
            })
            .catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[repositories] Neon insertOrder error:', err);
    }
  }

  return row;
}

export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  const mem = db.orders.find((o) => o.orderNumber === orderNumber);
  if (mem) return mem;

  const dbClient = await getDb();
  if (dbClient) {
    try {
      const [orderRow] = await dbClient
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.orderNumber, orderNumber));

      if (orderRow) {
        const itemRows = await dbClient
          .select()
          .from(schema.orderItems)
          .where(eq(schema.orderItems.orderId, orderRow.id));

        const order: Order = {
          id: orderRow.id,
          orderNumber: orderRow.orderNumber,
          userId: orderRow.userId,
          guestName: orderRow.guestName,
          guestEmail: orderRow.guestEmail,
          guestPhone: orderRow.guestPhone,
          storeId: orderRow.storeId,
          fulfillment: orderRow.fulfillment as any,
          addressLine: orderRow.addressLine,
          deliveryLat: orderRow.deliveryLat,
          deliveryLng: orderRow.deliveryLng,
          subtotal: orderRow.subtotal,
          tax: orderRow.tax,
          deliveryFee: orderRow.deliveryFee,
          tip: orderRow.tip,
          discount: orderRow.discount,
          total: orderRow.total,
          currency: orderRow.currency,
          status: orderRow.status as any,
          paymentMethod: orderRow.paymentMethod as any,
          paymentStatus: orderRow.paymentStatus as any,
          upiTransactionRef: orderRow.upiTransactionRef,
          verifiedAt: orderRow.verifiedAt ? orderRow.verifiedAt.toISOString() : null,
          deliveryPlan: orderRow.deliveryPlan as any,
          routeGeometry: orderRow.routeGeometry as any,
          routeSource: orderRow.routeSource as any,
          derivedStage: orderRow.derivedStage as any,
          placedAt: orderRow.placedAt ? orderRow.placedAt.toISOString() : new Date().toISOString(),
          confirmedAt: orderRow.confirmedAt ? orderRow.confirmedAt.toISOString() : null,
          cancelledAt: orderRow.cancelledAt ? orderRow.cancelledAt.toISOString() : null,
          items: itemRows.map((it) => ({
            id: it.id,
            drinkId: it.drinkId,
            nameSnapshot: it.nameSnapshot,
            unitPrice: it.unitPrice,
            quantity: it.quantity,
            modifiers: (it.modifiers as any) ?? [],
            lineTotal: it.unitPrice * it.quantity,
          })),
        };
        db.orders.unshift(order);
        return order;
      }
    } catch (err) {
      console.warn('[repositories] Neon getOrderByNumber error:', err);
    }
  }

  return null;
}

export async function updateOrder(orderNumber: string, patch: Partial<Order>): Promise<Order | null> {
  const i = db.orders.findIndex((o) => o.orderNumber === orderNumber);
  if (i !== -1) {
    db.orders[i] = { ...db.orders[i], ...patch };
    commit();
  }

  const dbClient = await getDb();
  if (dbClient) {
    try {
      const updateData: Record<string, unknown> = {};
      if (patch.status) updateData.status = patch.status;
      if (patch.paymentStatus) updateData.paymentStatus = patch.paymentStatus;
      if (patch.upiTransactionRef !== undefined) updateData.upiTransactionRef = patch.upiTransactionRef;
      if (patch.confirmedAt) updateData.confirmedAt = new Date(patch.confirmedAt);
      if (patch.cancelledAt) updateData.cancelledAt = new Date(patch.cancelledAt);
      if (patch.verifiedAt) updateData.verifiedAt = new Date(patch.verifiedAt);
      if (patch.derivedStage) updateData.derivedStage = patch.derivedStage;

      if (Object.keys(updateData).length > 0) {
        await dbClient
          .update(schema.orders)
          .set(updateData)
          .where(eq(schema.orders.orderNumber, orderNumber));
      }
    } catch (err) {
      console.warn('[repositories] Neon updateOrder error:', err);
    }
  }

  return i !== -1 ? db.orders[i] : null;
}

export async function listOrders(opts: { userId?: string; limit?: number } = {}): Promise<Order[]> {
  const dbClient = await getDb();
  if (dbClient) {
    try {
      let query = dbClient.select().from(schema.orders);
      if (opts.userId && safeUuid(opts.userId)) {
        query = query.where(eq(schema.orders.userId, opts.userId)) as any;
      }
      const rows = await query.limit(opts.limit ?? 50);
      if (rows.length > 0) {
        return rows.map((orderRow) => ({
          id: orderRow.id,
          orderNumber: orderRow.orderNumber,
          userId: orderRow.userId,
          guestName: orderRow.guestName,
          guestEmail: orderRow.guestEmail,
          guestPhone: orderRow.guestPhone,
          storeId: orderRow.storeId,
          fulfillment: orderRow.fulfillment as any,
          addressLine: orderRow.addressLine,
          deliveryLat: orderRow.deliveryLat,
          deliveryLng: orderRow.deliveryLng,
          subtotal: orderRow.subtotal,
          tax: orderRow.tax,
          deliveryFee: orderRow.deliveryFee,
          tip: orderRow.tip,
          discount: orderRow.discount,
          total: orderRow.total,
          currency: orderRow.currency,
          status: orderRow.status as any,
          paymentMethod: orderRow.paymentMethod as any,
          paymentStatus: orderRow.paymentStatus as any,
          upiTransactionRef: orderRow.upiTransactionRef,
          verifiedAt: orderRow.verifiedAt ? orderRow.verifiedAt.toISOString() : null,
          deliveryPlan: orderRow.deliveryPlan as any,
          routeGeometry: orderRow.routeGeometry as any,
          routeSource: orderRow.routeSource as any,
          derivedStage: orderRow.derivedStage as any,
          placedAt: orderRow.placedAt ? orderRow.placedAt.toISOString() : new Date().toISOString(),
          confirmedAt: orderRow.confirmedAt ? orderRow.confirmedAt.toISOString() : null,
          cancelledAt: orderRow.cancelledAt ? orderRow.cancelledAt.toISOString() : null,
          items: [],
        }));
      }
    } catch (err) {
      console.warn('[repositories] Neon listOrders error:', err);
    }
  }

  let rows = db.orders;
  if (opts.userId) rows = rows.filter((o) => o.userId === opts.userId);
  return rows.slice(0, opts.limit ?? 50);
}

/** Backed by the partial index `idx_orders_pending_upi` (§4.3). */
export async function listPendingUpiOrders(): Promise<Order[]> {
  const dbClient = await getDb();
  if (dbClient) {
    try {
      const rows = await dbClient
        .select()
        .from(schema.orders)
        .where(
          eq(schema.orders.paymentMethod, 'upi'),
        );
      if (rows.length > 0) {
        return rows
          .filter((r) => r.paymentStatus === 'pending')
          .map((orderRow) => ({
            id: orderRow.id,
            orderNumber: orderRow.orderNumber,
            userId: orderRow.userId,
            guestName: orderRow.guestName,
            guestEmail: orderRow.guestEmail,
            guestPhone: orderRow.guestPhone,
            storeId: orderRow.storeId,
            fulfillment: orderRow.fulfillment as any,
            addressLine: orderRow.addressLine,
            deliveryLat: orderRow.deliveryLat,
            deliveryLng: orderRow.deliveryLng,
            subtotal: orderRow.subtotal,
            tax: orderRow.tax,
            deliveryFee: orderRow.deliveryFee,
            tip: orderRow.tip,
            discount: orderRow.discount,
            total: orderRow.total,
            currency: orderRow.currency,
            status: orderRow.status as any,
            paymentMethod: orderRow.paymentMethod as any,
            paymentStatus: orderRow.paymentStatus as any,
            upiTransactionRef: orderRow.upiTransactionRef,
            verifiedAt: orderRow.verifiedAt ? orderRow.verifiedAt.toISOString() : null,
            deliveryPlan: orderRow.deliveryPlan as any,
            routeGeometry: orderRow.routeGeometry as any,
            routeSource: orderRow.routeSource as any,
            derivedStage: orderRow.derivedStage as any,
            placedAt: orderRow.placedAt ? orderRow.placedAt.toISOString() : new Date().toISOString(),
            confirmedAt: orderRow.confirmedAt ? orderRow.confirmedAt.toISOString() : null,
            cancelledAt: orderRow.cancelledAt ? orderRow.cancelledAt.toISOString() : null,
            items: [],
          }));
      }
    } catch (err) {
      console.warn('[repositories] Neon listPendingUpiOrders error:', err);
    }
  }

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
