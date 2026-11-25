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

const UA = 'aura-roast/2.0 (portfolio project; contact via repo)';

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

/** India Post PINs: six digits, never starting with 0. */
export const PINCODE_RE = /^[1-9][0-9]{5}$/;

export function isPincode(value: string | null | undefined): value is string {
  return !!value && PINCODE_RE.test(value.trim());
}

export interface PincodeHit extends GeocodeHit {
  pincode: string;
  /** The neighbourhood the PIN covers, e.g. "Indiranagar". */
  area: string;
  city: string;
  state: string;
}

/**
 * Where a PIN is. A structured `postalcode` search, not free text — "560038"
 * as free text can match a house number or a phone fragment. Cached forever
 * under `pin:` like every other geocode: postal districts do not move.
 */
export async function lookupPincode(raw: string): Promise<PincodeHit | null> {
  const pincode = raw.trim();
  if (!isPincode(pincode)) return null;
  const key = `pin:${pincode}`;

  const cached = await getGeocodeCache(key);
  if (cached) return { ...cached, pincode, ...splitDisplayName(cached.displayName, pincode) };

  try {
    const url =
      `https://nominatim.openstreetmap.org/search?` +
      new URLSearchParams({
        postalcode: pincode,
        country: 'India',
        format: 'jsonv2',
        addressdetails: '1',
        limit: '1',
      });
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as {
      lat: string;
      lon: string;
      display_name: string;
    }[];
    // Free-text fallback: Nominatim's postcode index has gaps the general
    // index does not, and "560038, India" still lands on the right district.
    const hit = rows[0]
      ? { lat: Number(rows[0].lat), lng: Number(rows[0].lon), displayName: rows[0].display_name }
      : await geocode(`${pincode}, India`);
    if (!hit) return null;
    await putGeocodeCache(key, hit);
    return { ...hit, pincode, ...splitDisplayName(hit.displayName, pincode) };
  } catch {
    return null;
  }
}

/** "560038, Indiranagar, Bengaluru …, Karnataka, India" → its readable parts. */
function splitDisplayName(displayName: string, pincode: string) {
  const parts = displayName
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && p !== pincode && p !== 'India' && !/corporation|zone \d|district|taluk|urban$/i.test(p));
  const state = parts.at(-1) ?? '';
  return { area: parts[0] ?? '', city: parts.length > 2 ? parts[1] : (parts[0] ?? ''), state };
}
