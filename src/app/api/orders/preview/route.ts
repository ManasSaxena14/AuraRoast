import { previewCart } from '@/services/catalog';
import { fail, ok } from '@/lib/http';
export const runtime = 'nodejs';
/** Authoritative cart totals. The only number checkout is allowed to show. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    return ok(await previewCart(body));
  } catch (err) {
    return fail(err);
  }
}
