import { book } from '@/services/reservation';
import { fail, ok, rateLimit, readJson } from '@/lib/http';
import { getViewer } from '@/lib/session';

export const runtime = 'nodejs';

/** Booking goes through ONE atomic capacity statement (§9.2). */
export async function POST(req: Request) {
  const limited = await rateLimit(req, 'reservations', 10, 60_000);
  if (limited) return limited;
  try {
    const [body, viewer] = await Promise.all([readJson(req), getViewer()]);
    const reservation = await book(body, viewer?.user.id ?? null);
    return ok({ reservation }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
