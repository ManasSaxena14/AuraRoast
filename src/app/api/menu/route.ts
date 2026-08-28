import { getMenu } from '@/services/catalog';
import { cached, fail } from '@/lib/http';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return cached(await getMenu(), 300);
  } catch (err) {
    return fail(err);
  }
}
