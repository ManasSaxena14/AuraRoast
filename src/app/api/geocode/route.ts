import { geocode, isPincode, lookupPincode, suggest } from '@/lib/nominatim';
import { DomainError } from '@/domain/errors';
import { fail, ok, rateLimit } from '@/lib/http';
export const runtime = 'nodejs';

/**
 * Server-side ONLY, with a real User-Agent and a persistent cache (§6.3).
 *
 *   ?q=…                 forward geocode
 *   ?q=…&mode=suggest    autocomplete (Photon)
 *   ?q=560038&mode=pincode   where an India Post PIN is — checkout uses it to
 *                        name the area back to the guest and pick the nearest bar
 */
export async function GET(req: Request) {
  const limited = await rateLimit(req, 'geocode', 30, 60_000);
  if (limited) return limited;
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').slice(0, 300);
    const mode = url.searchParams.get('mode');
    if (mode === 'suggest') return ok({ results: await suggest(q) });
    if (mode === 'pincode') {
      if (!isPincode(q)) throw new DomainError('A PIN code is six digits.', 'invalid_pincode', 400);
      return ok({ result: await lookupPincode(q) });
    }
    return ok({ result: await geocode(q) });
  } catch (err) {
    return fail(err);
  }
}
