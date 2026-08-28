/**
 * Loyalty tier is DERIVED ON READ, never stored (Blueprint §9.4).
 * Only `users.lifetime_points` exists in the schema. There is no `tier` column,
 * and a code review should reject one on sight.
 *
 * The four tiers are the four quadrants of the Halo filling in.
 */
export type TierName = 'Green' | 'Toast' | 'Crema' | 'Roastmaster';

export interface Tier {
  tier: TierName;
  pointsThreshold: number;
  quadrant: 1 | 2 | 3 | 4;
  perks: string[];
  blurb: string;
}

export const TIERS: readonly Tier[] = [
  {
    tier: 'Green',
    pointsThreshold: 0,
    quadrant: 1,
    perks: ['Birthday pour', 'Origin newsletter'],
    blurb: 'The seed. Unroasted, full of everything it is going to become.',
  },
  {
    tier: 'Toast',
    pointsThreshold: 500,
    quadrant: 2,
    perks: ['Free size upgrade', 'Early access to seasonal lots'],
    blurb: 'First crack. The irreversible act that makes it coffee.',
  },
  {
    tier: 'Crema',
    pointsThreshold: 1500,
    quadrant: 3,
    perks: ['Free delivery, always', 'One free cupping per quarter'],
    blurb: 'The surface holds. Pressure, time, and fat doing their work.',
  },
  {
    tier: 'Roastmaster',
    pointsThreshold: 4000,
    quadrant: 4,
    perks: ['12% off every order', 'Name a seasonal blend', 'Roastery invites'],
    blurb: 'You know the curve by heart. The Halo closes.',
  },
] as const;

export interface LoyaltyView {
  lifetimePoints: number;
  tier: Tier;
  next: Tier | null;
  pointsToNext: number;
  /** 0–1 progress within the CURRENT tier — drives the Halo quadrant fill. */
  tierProgress: number;
  /** 0–1 progress across all four tiers — drives the full ring. */
  overallProgress: number;
}

/** The one function. Called on every read; the result is never written back. */
export function deriveLoyalty(lifetimePoints: number): LoyaltyView {
  const points = Math.max(0, lifetimePoints | 0);
  let index = 0;
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (points >= TIERS[i].pointsThreshold) {
      index = i;
      break;
    }
  }
  const tier = TIERS[index];
  const next = TIERS[index + 1] ?? null;
  const span = next ? next.pointsThreshold - tier.pointsThreshold : 0;
  const into = points - tier.pointsThreshold;

  return {
    lifetimePoints: points,
    tier,
    next,
    pointsToNext: next ? Math.max(0, next.pointsThreshold - points) : 0,
    tierProgress: next ? Math.min(1, into / span) : 1,
    overallProgress: next
      ? (index + Math.min(1, into / span)) / TIERS.length
      : 1,
  };
}

/** 1 point per ₹10 spent, floored. Written to the append-only ledger. */
export function pointsForOrder(totalPaise: number): number {
  return Math.floor(totalPaise / 1000);
}

export function tierDiscountPercent(tier: TierName): number {
  return tier === 'Roastmaster' ? 12 : 0;
}
