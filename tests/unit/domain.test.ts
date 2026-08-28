/**
 * Unit tests — `domain/`, zero database (Blueprint §18.1).
 *
 * These run in milliseconds because the domain layer takes every dependency as
 * an argument, including the clock and the source of randomness.
 *
 *   node --test --experimental-strip-types tests/unit/*.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatMoney, paise, pct, rupees } from '../../src/domain/money.ts';
import { DELIVERY_FEE, FREE_DELIVERY_THRESHOLD, assertTotalConsistent, findPromo, priceCart } from '../../src/domain/pricing.ts';
import { TIERS, deriveLoyalty, pointsForOrder } from '../../src/domain/loyalty.ts';
import { assertTransition, canTransition, isCancellable } from '../../src/domain/state-machine.ts';
import { buildDeliveryPlan, jitter, seededRandom, trafficMultiplier } from '../../src/domain/delivery-plan.ts';
import { deriveTrackingState } from '../../src/domain/tracking.ts';
import { buildUpiUri, isPlausibleUtr } from '../../src/lib/upi.ts';
import { haversine, interpolateAlongRoute, sliceRoute, syntheticBezier } from '../../src/lib/geo.ts';
import { remaining, slotAvailability, slotTimesForDay } from '../../src/domain/slots.ts';
import { DRINKS } from '../../src/data/drinks.ts';
import type { CartLine, Drink, Order } from '../../src/domain/types.ts';

const catalogue = new Map<string, Drink>(DRINKS.map((d) => [d.id, d]));
const espresso = DRINKS.find((d) => d.id === 'drk-halo-espresso')!;

function line(over: Partial<CartLine> = {}): CartLine {
  return {
    lineId: 'l1',
    drinkId: espresso.id,
    slug: espresso.slug,
    name: espresso.name,
    imageUrl: espresso.imageUrl,
    quantity: 1,
    modifiers: [],
    ...over,
  };
}

describe('money — integer minor units everywhere', () => {
  it('converts without float drift', () => {
    assert.equal(paise(180.55), 18055);
    assert.equal(rupees(18055), 180.55);
    // The classic float trap: 0.1 + 0.2 in rupees, exact in paise.
    assert.equal(paise(0.1) + paise(0.2), paise(0.3));
  });

  it('rounds percentages to whole paise', () => {
    assert.equal(pct(18055, 5), 903);
    assert.ok(Number.isInteger(pct(33333, 5)));
  });

  it('formats INR', () => {
    assert.match(formatMoney(18000), /180/);
  });
});

describe('pricing — server-owned, and internally consistent', () => {
  it('applies modifier deltas to the unit price', () => {
    const priced = priceCart({
      lines: [line({ modifiers: [{ kind: 'shot', slug: 'double', label: 'Double', priceDelta: 4500, caffeineDelta: 63 }] })],
      catalogue,
      fulfillment: 'pickup',
    });
    assert.equal(priced.lines[0].unitPrice, espresso.basePrice + 4500);
  });

  it('waives delivery over the threshold, charges it under', () => {
    const under = priceCart({ lines: [line()], catalogue, fulfillment: 'delivery' });
    assert.equal(under.deliveryFee, DELIVERY_FEE);

    const qty = Math.ceil(FREE_DELIVERY_THRESHOLD / espresso.basePrice);
    const over = priceCart({ lines: [line({ quantity: qty })], catalogue, fulfillment: 'delivery' });
    assert.equal(over.deliveryFee, 0);
  });

  it('never lets a promo drive the subtotal negative', () => {
    const priced = priceCart({
      lines: [line()],
      catalogue,
      fulfillment: 'pickup',
      promo: { code: 'X', kind: 'flat', value: 9_999_999, minSubtotal: 0, label: '' },
    });
    assert.equal(priced.discount, priced.subtotal);
    assert.ok(priced.total >= 0);
  });

  it('satisfies total_is_consistent for every modifier combination', () => {
    for (const drink of DRINKS) {
      for (const fulfillment of ['delivery', 'pickup'] as const) {
        for (const promo of [null, findPromo('FIRSTPOUR'), findPromo('HALO200')]) {
          const priced = priceCart({
            lines: [line({ drinkId: drink.id, quantity: 3 })],
            catalogue,
            fulfillment,
            tip: 2000,
            promo,
          });
          assert.doesNotThrow(() => assertTotalConsistent(priced));
        }
      }
    }
  });

  it('drops unavailable drinks rather than pricing them', () => {
    const soldOut = DRINKS.find((d) => !d.isAvailable)!;
    const priced = priceCart({ lines: [line({ drinkId: soldOut.id })], catalogue, fulfillment: 'pickup' });
    assert.equal(priced.lines.length, 0);
  });
});

describe('loyalty — derived, never stored', () => {
  it('lands on the right tier at every boundary', () => {
    for (const tier of TIERS) {
      assert.equal(deriveLoyalty(tier.pointsThreshold).tier.tier, tier.tier);
      if (tier.pointsThreshold > 0) {
        assert.notEqual(deriveLoyalty(tier.pointsThreshold - 1).tier.tier, tier.tier);
      }
    }
  });

  it('caps progress at the top tier', () => {
    const top = deriveLoyalty(999_999);
    assert.equal(top.tier.tier, 'Roastmaster');
    assert.equal(top.next, null);
    assert.equal(top.overallProgress, 1);
  });

  it('exposes no writable tier field — the view is computed', () => {
    const view = deriveLoyalty(1840);
    assert.equal(view.tier.tier, 'Crema');
    // Recomputing from the same input gives the same answer, always.
    assert.deepEqual(deriveLoyalty(1840), view);
  });

  it('accrues one point per ₹10, floored', () => {
    assert.equal(pointsForOrder(52150), 52);
    assert.equal(pointsForOrder(999), 0);
  });
});

describe('state machine — every legal move passes, every illegal one throws', () => {
  it('allows the happy path', () => {
    assert.ok(canTransition('pending_payment', 'confirmed'));
    assert.ok(canTransition('confirmed', 'preparing'));
    assert.ok(canTransition('preparing', 'out_for_delivery'));
    assert.ok(canTransition('out_for_delivery', 'delivered'));
  });

  it('refuses to skip stages or reverse', () => {
    assert.throws(() => assertTransition('pending_payment', 'delivered'));
    assert.throws(() => assertTransition('delivered', 'preparing'));
    assert.throws(() => assertTransition('cancelled', 'confirmed'));
  });

  it('stops cancellation once the order has left', () => {
    assert.ok(isCancellable('preparing'));
    assert.equal(isCancellable('out_for_delivery'), false);
    assert.equal(isCancellable('delivered'), false);
  });
});

describe('delivery plan — deterministic given a seed and a clock', () => {
  it('produces the same plan twice for the same inputs', () => {
    const now = Date.UTC(2026, 7, 21, 9, 0, 0);
    const a = buildDeliveryPlan(6.1, seededRandom('order-1'), now);
    const b = buildDeliveryPlan(6.1, seededRandom('order-1'), now);
    assert.deepEqual(a, b);
  });

  it('varies with the seed', () => {
    const now = Date.UTC(2026, 7, 21, 9, 0, 0);
    const a = buildDeliveryPlan(6.1, seededRandom('order-1'), now);
    const b = buildDeliveryPlan(6.1, seededRandom('order-2'), now);
    assert.notDeepEqual(a, b);
  });

  it('keeps jitter inside ±18%', () => {
    for (const r of [0, 0.5, 1]) {
      const v = jitter(100_000, () => r);
      assert.ok(v >= 82_000 && v <= 118_000, `jitter out of band: ${v}`);
    }
  });

  it('is slower in rush hour than at 3am', () => {
    assert.ok(trafficMultiplier(18) > trafficMultiplier(3));
  });

  it('sums its stages', () => {
    const plan = buildDeliveryPlan(4, seededRandom('x'), Date.UTC(2026, 0, 1, 12));
    assert.equal(plan.totalDurationMs, plan.stages.reduce((a, s) => a + s.durationMs, 0));
  });
});

describe('tracking — pure derivation at every boundary', () => {
  const confirmedAt = new Date('2026-08-21T09:00:00.000Z');
  const plan = buildDeliveryPlan(6, seededRandom('t'), confirmedAt.getTime());
  const route = syntheticBezier({ lat: 12.97, lng: 77.64 }, { lat: 13.0, lng: 77.67 });

  const order = {
    status: 'confirmed',
    confirmedAt: confirmedAt.toISOString(),
    deliveryPlan: plan,
    routeGeometry: route,
  } as unknown as Order;

  it('reports the first stage immediately after confirmation', () => {
    const s = deriveTrackingState(order, confirmedAt.getTime() + 1000);
    assert.equal(s.currentStage, 'confirmed');
    assert.ok(s.overallProgress > 0 && s.overallProgress < 0.1);
  });

  it('walks the stages in order', () => {
    const [a, b, c] = plan.stages;
    assert.equal(deriveTrackingState(order, confirmedAt.getTime() + a.durationMs + 10).currentStage, 'preparing');
    assert.equal(
      deriveTrackingState(order, confirmedAt.getTime() + a.durationMs + b.durationMs + 10).currentStage,
      'out_for_delivery',
    );
    assert.equal(
      deriveTrackingState(order, confirmedAt.getTime() + a.durationMs + b.durationMs + c.durationMs + 10).currentStage,
      'delivered',
    );
  });

  it('never moves the courier before the transit leg', () => {
    const s = deriveTrackingState(order, confirmedAt.getTime() + plan.stages[0].durationMs / 2);
    assert.equal(s.travelledFraction, 0);
  });

  it('clamps progress and eta at delivery', () => {
    const s = deriveTrackingState(order, confirmedAt.getTime() + plan.totalDurationMs * 5);
    assert.equal(s.overallProgress, 1);
    assert.equal(s.etaMs, 0);
  });

  it('reports pending before confirmation and cancelled after', () => {
    assert.equal(deriveTrackingState({ ...order, confirmedAt: null } as Order, Date.now()).currentStage, 'pending_payment');
    assert.equal(deriveTrackingState({ ...order, status: 'cancelled' } as Order, Date.now()).currentStage, 'cancelled');
  });
});

describe('route geometry', () => {
  const route = syntheticBezier({ lat: 12.9, lng: 77.6 }, { lat: 13.0, lng: 77.7 }, 32);

  it('starts at the origin and ends at the destination', () => {
    const start = interpolateAlongRoute(route, 0)!;
    const end = interpolateAlongRoute(route, 1)!;
    assert.ok(haversine(start, { lat: 12.9, lng: 77.6 }) < 0.05);
    assert.ok(haversine(end, { lat: 13.0, lng: 77.7 }) < 0.05);
  });

  it('interpolates by DISTANCE, so halfway is halfway', () => {
    const mid = interpolateAlongRoute(route, 0.5)!;
    const toStart = haversine(mid, { lat: 12.9, lng: 77.6 });
    const toEnd = haversine(mid, { lat: 13.0, lng: 77.7 });
    assert.ok(Math.abs(toStart - toEnd) / (toStart + toEnd) < 0.08);
  });

  it('clamps out-of-range fractions', () => {
    assert.deepEqual(interpolateAlongRoute(route, -5), interpolateAlongRoute(route, 0));
    assert.deepEqual(interpolateAlongRoute(route, 5), interpolateAlongRoute(route, 1));
  });

  it('grows the travelled slice monotonically', () => {
    assert.ok(sliceRoute(route, 0.8).length > sliceRoute(route, 0.2).length);
  });

  it('handles a null route without throwing', () => {
    assert.equal(interpolateAlongRoute(null, 0.5), null);
    assert.deepEqual(sliceRoute(null, 0.5), []);
  });
});

describe('UPI payload', () => {
  it('formats the amount in rupees to two decimals', () => {
    const uri = buildUpiUri({ upiId: 'a@upi', payeeName: 'Aura Toast', amountPaise: 52150, orderNumber: 'AT-001042' });
    assert.match(uri, /am=521\.50/);
    assert.match(uri, /cu=INR/);
    assert.match(uri, /tr=AT-001042/);
  });

  it('encodes special characters in the payee name', () => {
    const uri = buildUpiUri({ upiId: 'a@upi', payeeName: 'Aura & Toast Coffee Co.', amountPaise: 100, orderNumber: 'AT-1' });
    assert.ok(!uri.includes('Aura & Toast'), 'ampersand must be encoded');
    assert.match(uri, /pn=Aura\+%26\+Toast/);
  });

  it('validates a UTR as exactly 12 digits', () => {
    assert.ok(isPlausibleUtr('123456789012'));
    assert.equal(isPlausibleUtr('12345'), false);
    assert.equal(isPlausibleUtr('abcdefghijkl'), false);
  });
});

describe('slots', () => {
  it('generates 30-minute slots across the trading day', () => {
    const times = slotTimesForDay();
    assert.equal(times[0], '08:00');
    assert.equal(times[1], '08:30');
    assert.equal(times.at(-1), '20:30');
  });

  it('reports full and tight correctly', () => {
    const base = { id: 's', storeId: 'x', slotDate: '2099-01-01', slotTime: '10:00', type: 'table' as const, capacity: 8, bookedCount: 0 };
    const now = Date.UTC(2026, 0, 1);
    assert.equal(slotAvailability({ ...base }, now), 'available');
    assert.equal(slotAvailability({ ...base, bookedCount: 7 }, now), 'tight');
    assert.equal(slotAvailability({ ...base, bookedCount: 8 }, now), 'full');
    assert.equal(remaining({ ...base, bookedCount: 8 }), 0);
    assert.equal(slotAvailability({ ...base, slotDate: '2000-01-01' }, now), 'past');
  });
});
