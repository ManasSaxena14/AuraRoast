import { cancel, lookup } from '@/services/reservation';
import { NotFoundError } from '@/domain/errors';
import { fail, ok, provesContact, rateLimit } from '@/lib/http';
import { getViewer, type Viewer } from '@/lib/session';
import type { Reservation } from '@/domain/types';

export const runtime = 'nodejs';

function mayManage(req: Request, r: Reservation, viewer: Viewer | null): boolean {
  if (viewer?.isAdmin) return true;
  if (viewer && r.userId && r.userId === viewer.user.id) return true;
  if (viewer && r.guestEmail.toLowerCase() === viewer.user.email.toLowerCase()) return true;
  return provesContact(req, r.guestEmail, r.guestPhone);
}

/** Enough to confirm a booking exists — and nothing about who made it. */
function publicView(r: Reservation) {
  return {
    reference: r.reference,
    status: r.status,
    partySize: r.partySize,
    slot: r.slot ? { slotDate: r.slot.slotDate, slotTime: r.slot.slotTime, type: r.slot.type } : undefined,
    store: r.store ? { name: r.store.name, address: r.store.address } : undefined,
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const limited = await rateLimit(req, 'reservation-lookup', 30, 60_000);
  if (limited) return limited;
  try {
    const { reference } = await params;
    const [r, viewer] = await Promise.all([lookup(reference), getViewer()]);
    return ok(
      { reservation: mayManage(req, r, viewer) ? r : publicView(r) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return fail(err);
  }
}

/** Cancelling releases the seats, so it needs the booking's own contact or owner. */
export async function DELETE(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const limited = await rateLimit(req, 'reservation-cancel', 10, 60_000);
  if (limited) return limited;
  try {
    const { reference } = await params;
    const [r, viewer] = await Promise.all([lookup(reference), getViewer()]);
    if (!mayManage(req, r, viewer)) throw new NotFoundError('Reservation');
    return ok({ reservation: publicView(await cancel(reference)) });
  } catch (err) {
    return fail(err);
  }
}
