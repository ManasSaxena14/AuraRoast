import { fetchWeather } from '@/lib/openmeteo';
import { DEFAULT_STORE } from '@/data/stores';
import { DomainError } from '@/domain/errors';
import { fail, ok } from '@/lib/http';
export const runtime = 'nodejs';

/**
 * `Number(raw) || DEFAULT` treated 0 as absent, so anyone on the equator or
 * the prime meridian silently got Bengaluru's weather. Absence is the only
 * thing that falls back to the default store; anything else must be a real,
 * in-range coordinate or it is a 400 — not a wasted round trip to Open-Meteo.
 */
function coordinate(raw: string | null, fallback: number, limit: number, name: string): number {
  if (raw === null || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < -limit || n > limit) {
    throw new DomainError(`${name} must be a number between -${limit} and ${limit}.`, 'invalid_coordinate', 400);
  }
  return n;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const lat = coordinate(url.searchParams.get('lat'), DEFAULT_STORE.lat, 90, 'lat');
    const lng = coordinate(url.searchParams.get('lng'), DEFAULT_STORE.lng, 180, 'lng');
    return ok({ weather: await fetchWeather(lat, lng) });
  } catch (err) {
    return fail(err);
  }
}
