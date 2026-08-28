import { listOrigins } from '@/repositories';
import { cached, fail } from '@/lib/http';
export const runtime = 'nodejs';
export async function GET() {
  try {
    return cached({ origins: await listOrigins() }, 600);
  } catch (err) {
    return fail(err);
  }
}
