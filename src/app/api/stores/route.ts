import { listStores } from '@/repositories';
import { cached, fail } from '@/lib/http';
export const runtime = 'nodejs';
export async function GET() {
  try {
    const stores = await listStores();
    return cached({ stores }, 600);
  } catch (err) {
    return fail(err);
  }
}
