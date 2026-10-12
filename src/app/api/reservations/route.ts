import { book } from '@/services/reservation';
import { fail, ok, rateLimit, readJson } from '@/lib/http';
import { getViewer } from '@/lib/session';
import { DomainError } from '@/domain/errors';

export const runtime = 'nodejs';

/** Booking goes through ONE atomic capacity statement (§9.2). Requires a signed-in account. */
export async function POST(req: Request) {
  const limited = await rateLimit(req, 'reservations', 10, 60_000);
  if (limited) return limited;
  try {
    const [body, viewer] = await Promise.all([readJson(req), getViewer()]);
    // A booking belongs to an account — that is where it is listed, changed
    // and cancelled from. Browsing availability stays open to everyone.
    if (!viewer) throw new DomainError('Sign in to book a table.', 'auth_required', 401);
    const reservation = await book(body, viewer.user.id);
    return ok({ reservation }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
