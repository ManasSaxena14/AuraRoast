import { availability, upcomingEvents } from '@/services/reservation';
import { DEFAULT_STORE } from '@/data/stores';
import { toDateKey } from '@/domain/slots';
import { fail, ok } from '@/lib/http';
export const runtime = 'nodejs';
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get('type') === 'event') return ok({ events: await upcomingEvents() });
    const storeId = url.searchParams.get('storeId') ?? DEFAULT_STORE.id;
    const date = url.searchParams.get('date') ?? toDateKey(new Date());
    return ok(await availability(storeId, date), { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return fail(err);
  }
}
