import { book } from '@/services/reservation';
import { fail, ok, rateLimit } from '@/lib/http';
export const runtime = 'nodejs';
/** Booking goes through ONE atomic capacity statement (§9.2). */
export async function POST(req: Request) {
  const limited = await rateLimit(req, 'reservations', 10, 60_000);
  if (limited) return limited;
  try {
    const body = await req.json();
    return ok({ reservation: await book(body) }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
