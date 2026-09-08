import { book } from '@/services/reservation';
import { fail, ok, rateLimit } from '@/lib/http';
import { DomainError } from '@/domain/errors';
export const runtime = 'nodejs';
/** Booking goes through ONE atomic capacity statement (§9.2). */
export async function POST(req: Request) {
  const limited = await rateLimit(req, 'reservations', 10, 60_000);
  if (limited) return limited;
  try {
    // A body that is not JSON at all makes `req.json()` throw a SyntaxError,
    // which `fail` cannot recognise and reports as a 500 — an unreadable
    // request is the caller's error, not ours.
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new DomainError('Malformed JSON body.', 'invalid_json', 400);
    }
    // `null` and `[]` are valid JSON, so the parse above accepts them and
    // `book` then reads fields off a non-object and throws a TypeError.
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new DomainError('That booking could not be read.', 'invalid_body', 400);
    }
    return ok({ reservation: await book(body as Parameters<typeof book>[0]) }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
