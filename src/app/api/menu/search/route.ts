import { search } from '@/services/catalog';
import { cached, fail } from '@/lib/http';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams.get('q') ?? '';
    return cached({ query: q, results: await search(q) }, 60);
  } catch (err) {
    return fail(err);
  }
}
