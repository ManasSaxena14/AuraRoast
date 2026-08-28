import { askBarista } from '@/services/chat';
import { fail, ok, rateLimit } from '@/lib/http';
export const runtime = 'nodejs';
/** Rate limited via the Postgres token bucket (§6.6). */
export async function POST(req: Request) {
  const limited = await rateLimit(req, 'chat', 20, 60_000);
  if (limited) return limited;
  try {
    const body = (await req.json()) as { message: string; history?: [] };
    return ok(await askBarista(body.history ?? [], body.message ?? ''));
  } catch (err) {
    return fail(err);
  }
}
