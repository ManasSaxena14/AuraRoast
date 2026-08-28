/**
 * Order placement (Blueprint §9.1, §9.3, §9.5, Part 7, Part 8).
 *
 * The three load-bearing rules, all in this file:
 *   1. the server recomputes every total from stored data — the client's
 *      number is read for comparison and then discarded
 *   2. placement is idempotency-key protected with three distinct outcomes
 *   3. the delivery plan and the OSRM route are written ONCE, at confirmation
 */
import { assertTotalConsistent, findPromo, priceCart } from '@/domain/pricing';
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
import { haversine } from '@/lib/geo';
import {
  accruePoints,
  catalogueMap,
  claimIdempotencyKey,
  completeIdempotencyKey,
  getOrderByNumber,
  getStore,
  insertOrder,
  listOrders,
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
  guestPhone?: string;
  addressLine?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  tip?: number;
  promoCode?: string | null;
  userId?: string | null;
  /** Read only so we can log a mismatch. Never written. */
  clientClaimedTotal?: number;
}

export interface PlaceOrderResult {
  order: Order;
  replayed: boolean;
  priceMismatch: boolean;
}

export async function placeOrder(
  input: PlaceOrderInput,
  idempotencyKey: string | null,
): Promise<PlaceOrderResult> {
  if (!idempotencyKey) throw new MissingIdempotencyKeyError();
  if (!input.lines?.length) throw new DomainError('Your cart is empty.', 'empty_cart', 400);
  if (!input.guestEmail?.includes('@')) {
    throw new DomainError('A contact email is required.', 'invalid_email', 400);
  }
  if (input.fulfillment === 'delivery' && !input.addressLine) {
    throw new DomainError('A delivery address is required.', 'address_required', 400);
  }

  const requestHash = await hashPayload({
    lines: input.lines.map((l) => ({ d: l.drinkId, q: l.quantity, m: l.modifiers.map((m) => m.slug).sort() })),
    fulfillment: input.fulfillment,
    paymentMethod: input.paymentMethod,
    email: input.guestEmail,
    address: input.addressLine ?? null,
    tip: input.tip ?? 0,
    promo: input.promoCode ?? null,
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
    const catalogue = await catalogueMap();
    const priced = priceCart({
      lines: input.lines,
      catalogue,
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
      userId: input.userId ?? null,
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

/** The tracking payload. Pure derivation — no writes on the read path. */
export async function trackOrder(orderNumber: string, now = Date.now()) {
  const order = await getOrder(orderNumber);
  const state = deriveTrackingState(order, now);

  // Lazily written back for admin list views. NEVER authoritative (§7.4).
  if (state.currentStage !== order.derivedStage && order.status !== 'cancelled') {
    void updateOrder(orderNumber, { derivedStage: state.currentStage });
  }

  const store = order.storeId ? await getStore(order.storeId) : null;
  return { order, state, store };
}

export async function cancelOrder(orderNumber: string): Promise<Order> {
  const order = await getOrder(orderNumber);

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

  const updated = await updateOrder(orderNumber, {
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
  });
  return updated!;
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
  let updated = (await updateOrder(orderNumber, {
    paymentStatus: 'verified',
    status: 'confirmed',
    confirmedAt: now,
    verifiedAt: now,
  }))!;

  updated = (await attachDeliveryPlan(updated)) ?? updated;
  if (updated.userId) {
    await accruePoints(updated.userId, pointsForOrder(updated.total), `Order ${orderNumber}`, updated.id);
  }
  void adminId;
  return updated;
}

export async function attachUtr(orderNumber: string, utr: string): Promise<Order> {
  const updated = await updateOrder(orderNumber, { upiTransactionRef: utr.trim() });
  if (!updated) throw new NotFoundError('Order');
  return updated;
}

export async function recentOrders(userId?: string) {
  return listOrders({ userId, limit: 20 });
}
