/**
 * Order placement (Blueprint §9.1, §9.3, §9.5, Part 7, Part 8).
 *
 * The three load-bearing rules, all in this file:
 *   1. the server recomputes every total from stored data — the client's
 *      number is read for comparison and then discarded
 *   2. placement is idempotency-key protected with three distinct outcomes
 *   3. the delivery plan and the OSRM route are written ONCE, at confirmation
 */
import { after } from 'next/server';
import { z } from 'zod';
import {
  MAX_LINE_QUANTITY,
  assertTotalConsistent,
  buildModifierIndex,
  findPromo,
  priceCart,
} from '@/domain/pricing';
import { buildDeliveryPlan, seededRandom } from '@/domain/delivery-plan';
import { deriveTrackingState } from '@/domain/tracking';
import { assertTransition, isCancellable } from '@/domain/state-machine';
import { pointsForOrder } from '@/domain/loyalty';
import {
  DomainError,
  IdempotencyConflictError,
  MissingIdempotencyKeyError,
  NotFoundError,
} from '@/domain/errors';
import { hashPayload, uuid } from '@/lib/ids';
import { fetchRoute } from '@/lib/osrm';
import { haversine, syntheticBezier } from '@/lib/geo';
import {
  accruePoints,
  catalogueMap,
  claimIdempotencyKey,
  completeIdempotencyKey,
  getOrderByNumber,
  getStore,
  insertOrder,
  listModifiers,
  releaseIdempotencyKey,
  updateOrder,
} from '@/repositories';
import type { CartLine, FulfillmentType, Order, OrderItem, PaymentMethod } from '@/domain/types';

export interface PlaceOrderInput {
  lines: CartLine[];
  fulfillment: FulfillmentType;
  paymentMethod: PaymentMethod;
  storeId: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string | null;
  addressLine?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  tip?: number;
  promoCode?: string | null;
  /** Read only so we can log a mismatch. Never written. */
  clientClaimedTotal?: number;
}

export interface PlaceOrderResult {
  order: Order;
  replayed: boolean;
  priceMismatch: boolean;
}

/**
 * The body arrives straight off the wire, so nothing in it may be dereferenced
 * before it is checked — a line without `modifiers` used to reach `hashPayload`
 * as a TypeError and surface as a 500. Shape only: the three domain rules below
 * (empty cart, contact email, delivery address) keep their own codes, and every
 * price is still re-derived from the stored catalogue (§9.1).
 */
const inputSchema = z.object({
  lines: z
    .array(
      z.object({
        lineId: z.string().default(''),
        drinkId: z.string().min(1).max(500),
        slug: z.string().max(500).default(''),
        name: z.string().max(500).default(''),
        imageUrl: z.string().default(''),
        quantity: z.coerce.number().int().min(1).max(MAX_LINE_QUANTITY),
        modifiers: z
          .array(
            z.object({
              kind: z.string().max(100),
              slug: z.string().max(200),
              label: z.string().max(500).default(''),
              priceDelta: z.number().default(0),
              caffeineDelta: z.number().default(0),
            }),
          )
          .max(50)
          .default([]),
      }),
    )
    .max(100)
    .default([]),
  fulfillment: z.enum(['delivery', 'pickup']).default('delivery'),
  paymentMethod: z.enum(['cash', 'upi']).default('cash'),
  storeId: z.string().max(200).default(''),
  guestName: z.string().max(200).default(''),
  guestEmail: z.string().max(300).default(''),
  guestPhone: z.string().max(100).nullish(),
  addressLine: z.string().max(1000).nullish(),
  deliveryLat: z.number().min(-90).max(90).nullish(),
  deliveryLng: z.number().min(-180).max(180).nullish(),
  tip: z.coerce.number().int().min(0).max(1_000_000).nullish(),
  promoCode: z.string().max(100).nullish(),
  clientClaimedTotal: z.number().optional(),
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * `userId` is the SIGNED-IN guest, resolved from the session by the route —
 * never read from the body. It used to be a body field, which let any caller
 * pour loyalty points into any account by naming it.
 */
export async function placeOrder(
  raw: unknown,
  idempotencyKey: string | null,
  userId: string | null = null,
): Promise<PlaceOrderResult> {
  if (!idempotencyKey) throw new MissingIdempotencyKeyError();

  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DomainError('That order could not be read.', 'invalid_body', 400, parsed.error.issues);
  }
  const input: PlaceOrderInput = parsed.data as unknown as PlaceOrderInput;
  input.guestName = input.guestName.trim();
  input.guestEmail = input.guestEmail.trim();
  input.addressLine = input.addressLine?.trim() || null;

  if (!input.lines.length) throw new DomainError('Your cart is empty.', 'empty_cart', 400);
  if (!input.guestName) throw new DomainError('A name is required.', 'name_required', 400);
  if (!EMAIL.test(input.guestEmail)) {
    throw new DomainError('A valid contact email is required.', 'invalid_email', 400);
  }
  if (input.fulfillment === 'delivery' && !input.addressLine) {
    throw new DomainError('A delivery address is required.', 'address_required', 400);
  }

  // Everything that is PERSISTED onto the order is hashed. Omitting storeId,
  // name, phone, coordinates or userId let a materially different request
  // replay as the original — a guest who switched pickup bar after a dropped
  // response got a success screen for the store they had left (§9.3).
  const requestHash = await hashPayload({
    lines: input.lines.map((l) => ({
      d: l.drinkId,
      q: l.quantity,
      // Slugs are only unique WITHIN a kind, so the key carries both.
      m: l.modifiers.map((m) => `${m.kind}:${m.slug}`).sort(),
    })),
    fulfillment: input.fulfillment,
    paymentMethod: input.paymentMethod,
    storeId: input.storeId,
    name: input.guestName,
    email: input.guestEmail,
    phone: input.guestPhone ?? null,
    address: input.addressLine ?? null,
    lat: input.deliveryLat ?? null,
    lng: input.deliveryLng ?? null,
    tip: input.tip ?? 0,
    promo: input.promoCode ?? null,
    userId,
  });

  const claim = await claimIdempotencyKey(idempotencyKey, requestHash);

  // Outcome 2 — same key, DIFFERENT payload. 422, not a silent replay.
  if (claim.outcome === 'conflict') throw new IdempotencyConflictError();

  // Outcome 3 — same key, same payload, already finished. Return the original.
  if (claim.outcome === 'replay' && claim.record?.response) {
    return { order: claim.record.response as Order, replayed: true, priceMismatch: false };
  }
  if (claim.outcome === 'in_progress') {
    throw new DomainError('That order is already being placed.', 'in_progress', 409);
  }

  try {
    // ── Server-owned pricing (§9.1) ─────────────────────────────────
    const [catalogue, modifierList] = await Promise.all([catalogueMap(), listModifiers()]);
    const priced = priceCart({
      lines: input.lines,
      catalogue,
      modifiers: buildModifierIndex(modifierList),
      fulfillment: input.fulfillment,
      tip: input.tip,
      promo: findPromo(input.promoCode),
    });
    if (!priced.lines.length) {
      throw new DomainError('Nothing in your cart is still available.', 'empty_cart', 409);
    }
    assertTotalConsistent(priced);

    const priceMismatch =
      typeof input.clientClaimedTotal === 'number' && input.clientClaimedTotal !== priced.total;
    if (priceMismatch) {
      console.warn('price_mismatch', {
        claimed: input.clientClaimedTotal,
        actual: priced.total,
      });
    }

    const store = (await getStore(input.storeId)) ?? (await getStore('indiranagar'));
    if (!store) throw new NotFoundError('Store');

    const items: OrderItem[] = priced.lines.map((l) => ({
      id: uuid(),
      drinkId: l.drinkId,
      nameSnapshot: l.name, // the catalogue can change; a receipt cannot
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      modifiers: l.modifiers,
      lineTotal: l.lineTotal,
    }));

    const now = Date.now();
    // Cash confirms immediately; UPI waits for a human (§8.2).
    const cash = input.paymentMethod === 'cash';

    const id = uuid();
    const base: Omit<Order, 'orderNumber'> = {
      id,
      userId,
      guestName: input.guestName,
      guestEmail: input.guestEmail,
      guestPhone: input.guestPhone ?? null,
      storeId: store.id,
      fulfillment: input.fulfillment,
      addressLine: input.addressLine ?? null,
      deliveryLat: input.deliveryLat ?? null,
      deliveryLng: input.deliveryLng ?? null,
      subtotal: priced.subtotal,
      tax: priced.tax,
      deliveryFee: priced.deliveryFee,
      tip: priced.tip,
      discount: priced.discount,
      total: priced.total,
      currency: priced.currency,
      status: cash ? 'confirmed' : 'pending_payment',
      paymentMethod: input.paymentMethod,
      paymentStatus: 'pending',
      upiTransactionRef: null,
      verifiedAt: null,
      deliveryPlan: null,
      routeGeometry: null,
      routeSource: null,
      derivedStage: null,
      placedAt: new Date(now).toISOString(),
      confirmedAt: cash ? new Date(now).toISOString() : null,
      cancelledAt: null,
      items,
    };

    let order = await insertOrder(base);

    // ── The plan + route, written exactly once (§7.2, §7.3) ─────────
    if (cash) {
      order = (await attachDeliveryPlan(order)) ?? order;
      if (order.userId) {
        await accruePoints(order.userId, pointsForOrder(order.total), `Order ${order.orderNumber}`, order.id);
      }
    }

    await completeIdempotencyKey(idempotencyKey, 201, order);
    return { order, replayed: false, priceMismatch };
  } catch (err) {
    // A failed attempt must not poison the key — the guest can retry.
    await releaseIdempotencyKey(idempotencyKey);
    throw err;
  }
}

/**
 * OSRM is called EXACTLY ONCE per order, here, and the geometry is persisted.
 * Every subsequent tracking read is arithmetic against stored data (§7.3).
 */
export async function attachDeliveryPlan(order: Order): Promise<Order | null> {
  const store = await getStore(order.storeId ?? '');
  if (!store) return order;

  const from = { lat: store.lat, lng: store.lng };
  const to =
    order.fulfillment === 'delivery' && order.deliveryLat != null && order.deliveryLng != null
      ? { lat: order.deliveryLat, lng: order.deliveryLng }
      : { lat: store.lat + 0.028, lng: store.lng + 0.024 }; // pickup: a short walk

  const route = await fetchRoute(from, to);
  const distanceKm = route.distanceKm || haversine(from, to);
  const plan = buildDeliveryPlan(
    distanceKm,
    seededRandom(order.id),
    new Date(order.confirmedAt ?? order.placedAt).getTime(),
    order.fulfillment,
  );

  return updateOrder(order.orderNumber, {
    deliveryPlan: plan,
    routeGeometry: route.geometry,
    routeSource: route.source,
  });
}

export async function getOrder(orderNumber: string): Promise<Order> {
  const order = await getOrderByNumber(orderNumber);
  if (!order) throw new NotFoundError('Order');
  return order;
}

/**
 * A confirmed order with no stored plan — one placed before plans were
 * persisted, or whose routing write failed — would otherwise read as
 * "Awaiting payment" forever. The plan is a pure function of the order (its
 * id seeds the randomness, its confirmation time is the clock), so it is
 * re-derived here, identically on every read, with a synthesized road.
 */
export async function withDerivedPlan(order: Order): Promise<Order> {
  if (order.deliveryPlan || !order.confirmedAt) return order;
  if (order.status === 'pending_payment' || order.status === 'cancelled') return order;
  const store = order.storeId ? await getStore(order.storeId) : null;
  if (!store) return order;
  const from = { lat: store.lat, lng: store.lng };
  const to =
    order.fulfillment === 'delivery' && order.deliveryLat != null && order.deliveryLng != null
      ? { lat: order.deliveryLat, lng: order.deliveryLng }
      : { lat: store.lat + 0.028, lng: store.lng + 0.024 };
  return {
    ...order,
    deliveryPlan: buildDeliveryPlan(
      haversine(from, to),
      seededRandom(order.id),
      new Date(order.confirmedAt).getTime(),
      order.fulfillment,
    ),
    routeGeometry: order.routeGeometry ?? syntheticBezier(from, to),
    routeSource: order.routeSource ?? 'synthetic',
  };
}

/** Run after the response is sent — and actually run: an unawaited promise in
 *  a serverless function is frozen with the instance the moment it replies. */
function afterResponse(task: () => Promise<unknown>) {
  const safe = () => task().catch((err) => console.warn('after_response_failed', err));
  try {
    after(safe);
  } catch {
    // Outside a request scope (a script, a test) there is nothing to defer to.
    void safe();
  }
}

/** The tracking payload. Pure derivation — no writes on the read path. */
export async function trackOrder(orderNumber: string, now = Date.now()) {
  const order = await withDerivedPlan(await getOrder(orderNumber));
  const state = deriveTrackingState(order, now);

  // Lazily written back for admin list views. NEVER authoritative (§7.4).
  if (state.currentStage !== order.derivedStage && order.status !== 'cancelled') {
    afterResponse(() => updateOrder(orderNumber, { derivedStage: state.currentStage }));
  }

  const store = order.storeId ? await getStore(order.storeId) : null;
  return { order, state, store };
}

const OPEN_STATUSES = ['pending_payment', 'confirmed', 'preparing'] as const;

export async function cancelOrder(orderNumber: string): Promise<Order> {
  const order = await withDerivedPlan(await getOrder(orderNumber));
  if (order.status === 'cancelled') return order;

  // The live stage, not the stored column, decides whether cancelling is legal.
  const live = deriveTrackingState(order, Date.now());
  const effective = order.status === 'pending_payment' ? 'pending_payment' : live.currentStage;

  if (!isCancellable(effective)) {
    throw new DomainError(
      'This order has already left the bar and cannot be cancelled.',
      'not_cancellable',
      409,
    );
  }
  assertTransition(effective, 'cancelled');

  // Guarded: if an admin verified it or another tab cancelled it in between,
  // the write matches no row instead of clobbering that change.
  const updated = await updateOrder(
    orderNumber,
    { status: 'cancelled', cancelledAt: new Date().toISOString() },
    { status: [...OPEN_STATUSES] },
  );
  if (updated) return updated;
  const now = await getOrder(orderNumber);
  if (now.status === 'cancelled') return now;
  throw new DomainError('That order changed while cancelling — reload and try again.', 'conflict', 409);
}

/** The ONLY path that confirms a UPI order (§8.4). Admin-only, re-verified. */
export async function verifyUpiPayment(orderNumber: string, adminId: string): Promise<Order> {
  const order = await getOrder(orderNumber);
  if (order.paymentMethod !== 'upi') {
    throw new DomainError('That order is not a UPI order.', 'not_upi', 409);
  }
  if (order.paymentStatus === 'verified') return order;
  assertTransition(order.status, 'confirmed');

  const now = new Date().toISOString();
  // Two admins pressing Verify at once must confirm it — and accrue points —
  // exactly once. Only the write that finds it still pending wins.
  const verified = await updateOrder(
    orderNumber,
    { paymentStatus: 'verified', status: 'confirmed', confirmedAt: now, verifiedAt: now },
    { status: ['pending_payment'], paymentStatus: ['pending'] },
  );
  if (!verified) {
    const current = await getOrder(orderNumber);
    if (current.paymentStatus === 'verified') return current;
    throw new DomainError(`That order is ${current.status.replace(/_/g, ' ')} now.`, 'conflict', 409);
  }

  const routed = (await attachDeliveryPlan(verified)) ?? verified;
  if (routed.userId) {
    await accruePoints(routed.userId, pointsForOrder(routed.total), `Order ${orderNumber}`, routed.id);
  }
  void adminId;
  return routed;
}

export async function attachUtr(orderNumber: string, utr: string): Promise<Order> {
  const updated = await updateOrder(
    orderNumber,
    { upiTransactionRef: utr.trim() },
    { paymentStatus: ['pending'] },
  );
  if (!updated) {
    throw new DomainError('That payment has already been settled.', 'not_pending', 409);
  }
  return updated;
}
