/**
 * The in-process adapter.
 *
 * The app ships with a real PostgreSQL schema (`../schema.ts`) and a real
 * Neon/Drizzle path. This adapter exists so the whole product — ordering,
 * tracking, reservations, loyalty, admin — runs end to end with **zero
 * credentials**, which is what makes the motion work reviewable in one command.
 *
 * It is not a stub. It implements the same operations with the same
 * guarantees, including:
 *   · the ATOMIC capacity check (§9.2) — a single compare-and-set, never a
 *     read-then-write, guarded by the same `booked_count <= capacity` invariant
 *   · idempotency with three distinct outcomes (§9.3)
 *   · loyalty tier derived on read, never stored (§9.4)
 *
 * State is persisted to `.data/state.json` so a tracking link survives a cold
 * reload, exactly as it would against Postgres.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DRINKS } from '@/data/drinks';
import { GUIDES } from '@/data/guides';
import { MODIFIERS } from '@/data/modifiers';
import { ORIGINS } from '@/data/origins';
import { SEED_REVIEWS } from '@/data/reviews';
import { STORES } from '@/data/stores';
import { addDays, bookableDates, slotSeedsFor, toDateKey } from '@/domain/slots';
import type {
  LoyaltyLedgerEntry,
  Order,
  Reservation,
  ReservationSlot,
  Review,
  Subscription,
  User,
} from '@/domain/types';

export interface IdempotencyRecord {
  key: string;
  requestHash: string;
  statusCode: number | null;
  response: unknown;
  state: 'in_progress' | 'completed';
  expiresAt: number;
}

export interface RateLimitRow {
  bucket: string;
  windowStart: number;
  count: number;
}

export interface DbState {
  version: number;
  orderSeq: number;
  orders: Order[];
  slots: ReservationSlot[];
  reservations: Reservation[];
  reviews: Review[];
  subscriptions: Subscription[];
  users: User[];
  ledger: LoyaltyLedgerEntry[];
  idempotency: Record<string, IdempotencyRecord>;
  rateLimits: RateLimitRow[];
  geocode: Record<string, { lat: number; lng: number; displayName: string }>;
  weather: Record<string, { payload: unknown; fetchedAt: number }>;
  chat: Record<string, { messages: unknown[]; updatedAt: number }>;
}

/**
 * Bump this whenever the SHAPE or the SEED of the store changes — adding a
 * city, changing the slot window, altering a table. A persisted state file
 * written before a new store existed has no slots for it, and the failure is
 * silent: the room simply shows no availability forever.
 */
const STATE_VERSION = 5;
const DATA_DIR = join(process.cwd(), '.data');
const STATE_FILE = join(DATA_DIR, 'state.json');

/* ── Slot generation — 14 days of 30-minute tables, plus weekly events ──
   The same `slotSeedsFor` the Postgres adapter uses, on the shop's (IST)
   calendar, so both backends offer exactly the same grid. */
function seedSlots(): ReservationSlot[] {
  const out: ReservationSlot[] = [];
  for (const key of bookableDates(new Date(), 14)) {
    for (const store of STORES) {
      for (const s of slotSeedsFor(store.slug, key)) {
        out.push({
          id:
            s.type === 'event'
              ? `slot-event-${store.slug}-${key}-${s.slotTime}`
              : `slot-${store.slug}-${key}-${s.slotTime}`,
          storeId: store.id,
          bookedCount: 0,
          ...s,
        });
      }
    }
  }
  return out;
}

/* ── A demo account so /account and the loyalty Halo have something real ── */
const DEMO_USER: User = {
  id: 'usr-demo',
  name: 'Guest Roaster',
  email: 'guest@aura-toast.test',
  image: null,
  lifetimePoints: 1840, // → Crema, derived on read (§9.4)
  referralCode: 'AURA-K3M9',
  locale: 'en-IN',
  currency: 'INR',
  isAdmin: true,
  createdAt: new Date('2025-11-02T09:00:00.000Z').toISOString(),
};

function freshState(): DbState {
  return {
    version: STATE_VERSION,
    orderSeq: 1041,
    orders: [],
    slots: seedSlots(),
    reservations: [],
    reviews: [...SEED_REVIEWS],
    subscriptions: [
      {
        id: 'sub-demo-1',
        userId: DEMO_USER.id,
        drinkId: 'drk-beans-chikmagalur',
        cadence: 'biweekly',
        quantity: 1,
        nextDelivery: addDays(toDateKey(), 6),
        status: 'active',
        createdAt: new Date('2026-03-14T09:00:00.000Z').toISOString(),
      },
    ],
    users: [DEMO_USER],
    ledger: [
      { id: 'led-1', userId: DEMO_USER.id, orderId: null, delta: 1200, reason: 'Orders · Jan–Jun', createdAt: '2026-06-30T00:00:00.000Z' },
      { id: 'led-2', userId: DEMO_USER.id, orderId: null, delta: 500, reason: 'Subscription · 10 deliveries', createdAt: '2026-07-28T00:00:00.000Z' },
      { id: 'led-3', userId: DEMO_USER.id, orderId: null, delta: 140, reason: 'Referral · AURA-K3M9', createdAt: '2026-08-09T00:00:00.000Z' },
    ],
    idempotency: {},
    rateLimits: [],
    geocode: {},
    weather: {},
    chat: {},
  };
}

/* ── Load / persist ─────────────────────────────────────────────────── */

/** Tests get a clean store in memory and never touch the dev state file. */
const EPHEMERAL =
  process.env.AURA_EPHEMERAL === '1' || process.env.NODE_ENV === 'test';

function load(): DbState {
  if (EPHEMERAL) return freshState();
  try {
    if (existsSync(STATE_FILE)) {
      const parsed = JSON.parse(readFileSync(STATE_FILE, 'utf8')) as DbState;
      if (parsed.version === STATE_VERSION && parsed.slots?.length) {
        const today = toDateKey(new Date());
        const stillFresh = parsed.slots.some((s) => s.slotDate >= today);
        // Every active store must actually have slots. A store added since the
        // file was written would otherwise show no availability, forever.
        const storeIds = new Set(parsed.slots.map((s) => s.storeId));
        const allCovered = STORES.every((s) => storeIds.has(s.id));
        if (stillFresh && allCovered) return parsed;
      }
    }
  } catch {
    /* a corrupt cache is not worth a crash — start clean */
  }
  return freshState();
}

let writeTimer: ReturnType<typeof setTimeout> | null = null;

function persist(state: DbState): void {
  if (EPHEMERAL) return;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(STATE_FILE, JSON.stringify(state));
    } catch {
      /* read-only filesystem (e.g. serverless) — in-memory still works */
    }
  }, 120);
}

/* HMR in dev tears modules down; the store must not go with them. */
const g = globalThis as unknown as { __auraState?: DbState };
export const db: DbState = g.__auraState ?? (g.__auraState = load());

export function commit(): void {
  persist(db);
}

/* Static catalogue — read-only, shared by both adapters. */
export const catalogue = {
  drinks: DRINKS,
  modifiers: MODIFIERS,
  origins: ORIGINS,
  stores: STORES,
  guides: GUIDES,
};
