/**
 * Slot capacity rules (Blueprint §9.2 companion).
 * The ATOMIC booking itself lives in the repository — this file only owns the
 * pure rules about which slots exist and when they can still be booked.
 */
import { DomainError } from './errors';
import type { ReservationSlot, ReservationType } from './types';

export const SLOT_MINUTES = 30;
export const OPEN_HOUR = 8;
export const CLOSE_HOUR = 21;
export const MAX_PARTY_SIZE = 8;
export const BOOKING_HORIZON_DAYS = 21;

export function slotTimesForDay(): string[] {
  const out: string[] = [];
  for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return out;
}

/**
 * Every room is in India, so the shop's calendar is IST (UTC+5:30, no DST) —
 * whatever zone the server runs in (UTC on Vercel) or the guest's phone is set
 * to. Deriving "today" and "has this slot passed" from the host's local clock
 * kept an 08:00 table bookable until 13:30 IST.
 */
export const SHOP_TIME_ZONE = 'Asia/Kolkata';
const SHOP_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

/** The shop's calendar day (YYYY-MM-DD) at a given instant. */
export function toDateKey(d: Date = new Date()): string {
  return new Date(d.getTime() + SHOP_OFFSET_MS).toISOString().slice(0, 10);
}

/** Calendar arithmetic on a date key — no clock, no zone. */
export function addDays(dateKey: string, days: number): string {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, for a date key. */
export function weekdayOf(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}

/** A date key as a Date at UTC midnight — format it with `timeZone: 'UTC'`. */
export function dateKeyToUtc(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00Z`);
}

export function bookableDates(now: Date, days = 14): string[] {
  const today = toDateKey(now);
  return Array.from({ length: days }, (_, i) => addDays(today, i));
}

export function slotStartMs(slot: Pick<ReservationSlot, 'slotDate' | 'slotTime'>): number {
  return Date.parse(`${slot.slotDate}T${slot.slotTime.slice(0, 5)}:00+05:30`);
}

export function isPast(slot: ReservationSlot, now: number): boolean {
  return slotStartMs(slot) < now;
}

export function remaining(slot: ReservationSlot): number {
  return Math.max(0, slot.capacity - slot.bookedCount);
}

export type SlotAvailability = 'available' | 'tight' | 'full' | 'past';

export function slotAvailability(slot: ReservationSlot, now: number): SlotAvailability {
  if (isPast(slot, now)) return 'past';
  const left = remaining(slot);
  if (left <= 0) return 'full';
  if (left <= Math.max(1, Math.round(slot.capacity * 0.25))) return 'tight';
  return 'available';
}

/** Every guest takes a seat — at a table, and at the cupping bench alike. */
export function seatsConsumed(_type: ReservationType, partySize: number): number {
  return partySize;
}

/**
 * The slots a room offers on a day — the ONE generator both adapters use, so
 * the in-process store and Postgres can never disagree about what exists.
 * Saturday cuppings run in Jayanagar and Wednesday brew classes in
 * Koramangala, on the same capacity engine as the tables (§2.1).
 */
export interface SlotSeed {
  slotDate: string;
  slotTime: string;
  type: ReservationType;
  capacity: number;
  eventTitle?: string;
  eventPrice?: number;
}

export const EVENT_STORES = { cupping: 'jayanagar', brewClass: 'koramangala' } as const;

export function slotSeedsFor(storeSlug: string, dateKey: string): SlotSeed[] {
  const day = weekdayOf(dateKey);
  const weekend = day === 0 || day === 6;
  const out: SlotSeed[] = slotTimesForDay().map((t) => {
    const hour = Number(t.slice(0, 2));
    const peak = hour >= 8 && hour <= 11;
    return {
      slotDate: dateKey,
      slotTime: t,
      type: 'table' as const,
      capacity: peak ? (weekend ? 10 : 8) : weekend ? 8 : 6,
    };
  });
  if (day === 6 && storeSlug === EVENT_STORES.cupping) {
    out.push({
      slotDate: dateKey,
      slotTime: '09:00',
      type: 'event',
      capacity: 12,
      eventTitle: 'Saturday Cupping · five origins, blind',
      eventPrice: 60000,
    });
  }
  if (day === 3 && storeSlug === EVENT_STORES.brewClass) {
    out.push({
      slotDate: dateKey,
      slotTime: '18:30',
      type: 'event',
      capacity: 8,
      eventTitle: 'Brew Class · V60 from first principles',
      eventPrice: 95000,
    });
  }
  return out;
}

export function validatePartySize(n: number): void {
  if (!Number.isInteger(n) || n < 1 || n > MAX_PARTY_SIZE) {
    // A `DomainError`, not a bare one: this is the FIRST statement of `book()`,
    // so a plain Error here surfaces as a 500 and the guest never reads the
    // message that was written for them.
    throw new DomainError(`Party size must be 1–${MAX_PARTY_SIZE}.`, 'invalid_party_size', 400);
  }
}
