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

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function bookableDates(now: Date, days = 14): string[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    return toDateKey(d);
  });
}

export function slotStartMs(slot: Pick<ReservationSlot, 'slotDate' | 'slotTime'>): number {
  return new Date(`${slot.slotDate}T${slot.slotTime}:00`).getTime();
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

/** A booking consumes one seat per guest for tables, one per booking for events. */
export function seatsConsumed(type: ReservationType, partySize: number): number {
  return type === 'event' ? partySize : partySize;
}

export function validatePartySize(n: number): void {
  if (!Number.isInteger(n) || n < 1 || n > MAX_PARTY_SIZE) {
    // A `DomainError`, not a bare one: this is the FIRST statement of `book()`,
    // so a plain Error here surfaces as a 500 and the guest never reads the
    // message that was written for them.
    throw new DomainError(`Party size must be 1–${MAX_PARTY_SIZE}.`, 'invalid_party_size', 400);
  }
}
