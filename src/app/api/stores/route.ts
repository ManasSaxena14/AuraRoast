import { listStores } from '@/repositories';
import { cached, fail } from '@/lib/http';
export const runtime = 'nodejs';
export async function GET() {
  try {
    return cached({ stores: await listStores() }, 600);
  } catch (err) {
    return fail(err);
  }
}
