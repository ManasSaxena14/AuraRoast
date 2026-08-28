import { geocode, suggest } from '@/lib/nominatim';
import { fail, ok, rateLimit } from '@/lib/http';
export const runtime = 'nodejs';
/** Server-side ONLY, with a real User-Agent and a persistent cache (§6.3). */
export async function GET(req: Request) {
  const limited = await rateLimit(req, 'geocode', 30, 60_000);
  if (limited) return limited;
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get('q') ?? '';
    if (url.searchParams.get('mode') === 'suggest') return ok({ results: await suggest(q) });
    return ok({ result: await geocode(q) });
  } catch (err) {
    return fail(err);
  }
}
