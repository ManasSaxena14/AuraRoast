/**
 * Geocoding (Blueprint §6.3). Server-side only, with a real User-Agent and a
 * persistent cache, because that is what the Nominatim usage policy asks for.
 */
import { getGeocodeCache, putGeocodeCache } from '@/repositories';

export interface GeocodeHit {
  lat: number;
  lng: number;
  displayName: string;
}

const UA = 'aura-toast/2.0 (portfolio project; contact via repo)';

function normalize(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Forward geocode. Cached forever — a place does not move. */
export async function geocode(query: string): Promise<GeocodeHit | null> {
  const key = normalize(query);
  if (!key) return null;

  const cached = await getGeocodeCache(key);
  if (cached) return cached;

  try {
    const url =
      `https://nominatim.openstreetmap.org/search?` +
      new URLSearchParams({ q: key, format: 'jsonv2', limit: '1', countrycodes: 'in' });
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    if (!rows.length) return null;

    const hit: GeocodeHit = {
      lat: Number(rows[0].lat),
      lng: Number(rows[0].lon),
      displayName: rows[0].display_name,
    };
    await putGeocodeCache(key, hit);
    return hit;
  } catch {
    return null;
  }
}

/** Autocomplete uses Photon — it is built for prefix queries, Nominatim is not. */
export async function suggest(query: string): Promise<GeocodeHit[]> {
  const key = normalize(query);
  if (key.length < 3) return [];
  try {
    const url =
      `https://photon.komoot.io/api/?` +
      new URLSearchParams({ q: key, limit: '5', lang: 'en' });
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      features?: {
        geometry: { coordinates: [number, number] };
        properties: Record<string, string>;
      }[];
    };
    return (data.features ?? []).map((f) => ({
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      displayName: [
        f.properties.name,
        f.properties.district,
        f.properties.city,
        f.properties.state,
      ]
        .filter(Boolean)
        .join(', '),
    }));
  } catch {
    return [];
  }
}
