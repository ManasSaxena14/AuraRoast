/**
 * Delivery simulation (Blueprint §7.2).
 * Pure function — takes its randomness and its clock as arguments, so the
 * unit tests are fully deterministic.
 */
import type { DeliveryPlan } from './types';

/** Traffic by hour of day. A lookup curve, not a magic multiplier. */
export function trafficMultiplier(hour: number): number {
  const CURVE = [
    0.8, 0.8, 0.8, 0.8, 0.85, 0.95, // 00–05
    1.1, 1.35, 1.5, 1.4, 1.15, 1.05, // 06–11
    1.1, 1.15, 1.05, 1.05, 1.2, 1.45, // 12–17
    1.55, 1.4, 1.2, 1.05, 0.95, 0.85, // 18–23
  ];
  return CURVE[((hour % 24) + 24) % 24];
}

/** ±18% jitter so two identical orders do not run in lockstep. */
export function jitter(baseMs: number, rand: () => number): number {
  return Math.round(baseMs * (0.82 + rand() * 0.36));
}

export const AVERAGE_COURIER_KMH = 18;

export function buildDeliveryPlan(
  distanceKm: number,
  rand: () => number,
  now: number,
  fulfillment: 'delivery' | 'pickup' = 'delivery',
): DeliveryPlan {
  const traffic = trafficMultiplier(new Date(now).getHours());
  const transitMs =
    fulfillment === 'pickup'
      ? jitter(180_000, rand)
      : Math.round((distanceKm / AVERAGE_COURIER_KMH) * 3_600_000 * traffic);

  const stages = [
    { name: 'confirmed' as const, durationMs: jitter(45_000, rand) },
    { name: 'preparing' as const, durationMs: Math.round(jitter(240_000, rand) * traffic) },
    { name: 'out_for_delivery' as const, durationMs: Math.max(60_000, transitMs) },
  ];

  return {
    stages,
    totalDurationMs: stages.reduce((a, s) => a + s.durationMs, 0),
    distanceKm,
    trafficMultiplier: traffic,
  };
}

/** A seeded PRNG so an order's plan is reproducible from its own id. */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
