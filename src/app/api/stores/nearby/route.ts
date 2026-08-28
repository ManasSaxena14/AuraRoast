import { listStores } from '@/repositories';
import { haversine } from '@/lib/geo';
import { cached, fail } from '@/lib/http';
export const runtime = 'nodejs';
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const lat = Number(url.searchParams.get('lat'));
    const lng = Number(url.searchParams.get('lng'));
    const stores = await listStores();
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return cached({ stores }, 60);
    const ranked = stores
      .map((s) => ({ ...s, distanceKm: haversine({ lat, lng }, { lat: s.lat, lng: s.lng }) }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
    return cached({ stores: ranked }, 60);
  } catch (err) {
    return fail(err);
  }
}
