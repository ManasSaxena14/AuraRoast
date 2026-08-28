import { fetchWeather } from '@/lib/openmeteo';
import { DEFAULT_STORE } from '@/data/stores';
import { fail, ok } from '@/lib/http';
export const runtime = 'nodejs';
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const lat = Number(url.searchParams.get('lat')) || DEFAULT_STORE.lat;
    const lng = Number(url.searchParams.get('lng')) || DEFAULT_STORE.lng;
    return ok({ weather: await fetchWeather(lat, lng) });
  } catch (err) {
    return fail(err);
  }
}
