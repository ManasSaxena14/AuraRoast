/**
 * Reservations (Blueprint §9.2).
 *
 * The booking is ONE atomic statement in the repository. There is no
 * `SELECT booked_count` before it anywhere in this file — that read-then-write
 * gap is the entire race this design removes.
 */
import { DomainError, NotFoundError } from '@/domain/errors';
import { assertReservationTransition } from '@/domain/state-machine';
import { slotAvailability, toDateKey, validatePartySize, remaining } from '@/domain/slots';
import { reservationReference, uuid } from '@/lib/ids';
import {
  bookSlotAtomically,
  getReservation,
  getSlot,
  getStore,
  insertReservation,
  listEventSlots,
  listSlots,
  releaseSlot,
  updateReservation,
} from '@/repositories';
import type { Reservation, ReservationType } from '@/domain/types';

export async function availability(storeId: string, slotDate: string, type: ReservationType = 'table') {
  const [slots, store] = await Promise.all([listSlots(storeId, slotDate, type), getStore(storeId)]);
  const now = Date.now();
  return {
    store,
    date: slotDate,
    slots: slots.map((s) => ({
      id: s.id,
      time: s.slotTime,
      capacity: s.capacity,
      remaining: remaining(s),
      state: slotAvailability(s, now),
      eventTitle: s.eventTitle,
      eventPrice: s.eventPrice,
    })),
  };
}

export async function upcomingEvents() {
  const slots = await listEventSlots(toDateKey(new Date()));
  const now = Date.now();
  return Promise.all(
    slots.slice(0, 8).map(async (s) => ({
      id: s.id,
      date: s.slotDate,
      time: s.slotTime,
      title: s.eventTitle ?? 'Event',
      price: s.eventPrice ?? 0,
      capacity: s.capacity,
      remaining: remaining(s),
      state: slotAvailability(s, now),
      store: await getStore(s.storeId),
    })),
  );
}

export interface BookInput {
  slotId: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  partySize: number;
  notes?: string;
  userId?: string | null;
}

export async function book(input: BookInput): Promise<Reservation> {
  validatePartySize(input.partySize);
  if (!input.guestEmail?.includes('@')) {
    throw new DomainError('A contact email is required.', 'invalid_email', 400);
  }
  if (!input.guestName?.trim()) {
    throw new DomainError('A name is required.', 'name_required', 400);
  }

  const slot = await getSlot(input.slotId);
  if (!slot) throw new NotFoundError('Slot');
  if (slotAvailability(slot, Date.now()) === 'past') {
    throw new DomainError('That slot has already passed.', 'slot_past', 409);
  }

  // ── The atomic step. Throws SlotFullError when the seats are gone. ──
  await bookSlotAtomically(input.slotId, input.partySize);

  try {
    return await insertReservation({
      id: uuid(),
      reference: reservationReference(),
      slotId: input.slotId,
      userId: input.userId ?? null,
      guestName: input.guestName.trim(),
      guestEmail: input.guestEmail.trim(),
      guestPhone: input.guestPhone?.trim() ?? null,
      partySize: input.partySize,
      notes: input.notes?.trim() ?? null,
      status: 'booked',
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    // The seats were taken but the row failed — give them back.
    await releaseSlot(input.slotId, input.partySize);
    throw err;
  }
}

export async function lookup(reference: string) {
  const r = await getReservation(reference);
  if (!r) throw new NotFoundError('Reservation');
  return r;
}

export async function cancel(reference: string): Promise<Reservation> {
  const r = await lookup(reference);
  assertReservationTransition(r.status, 'cancelled');
  await releaseSlot(r.slotId, r.partySize);
  const updated = await updateReservation(reference, {
    status: 'cancelled',
  });
  return updated!;
}
