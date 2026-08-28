/**
 * Routing (Blueprint §7.3).
 *
 * OSRM is called EXACTLY ONCE per order, at confirmation, and the GeoJSON
 * geometry is persisted. Every subsequent tracking read is pure arithmetic
 * against stored data — zero external calls, ever. The free API's fair-use
 * limits are respected structurally, not by hoping traffic stays low.
 */
import { haversine, syntheticBezier } from './geo';
import type { LatLng, RouteGeometry } from '@/domain/types';

export interface RouteResult {
  geometry: RouteGeometry;
  distanceKm: number;
  source: 'osrm' | 'synthetic';
}

export async function fetchRoute(from: LatLng, to: LatLng): Promise<RouteResult> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?overview=full&geometries=geojson`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'aura-toast/2.0 (portfolio project)' },
    });
    if (!res.ok) throw new Error(`OSRM ${res.status}`);

    const data = (await res.json()) as {
      routes?: { geometry: RouteGeometry; distance: number }[];
    };
    const route = data.routes?.[0];
    if (!route?.geometry?.coordinates?.length) throw new Error('no route');

    return { geometry: route.geometry, distanceKm: route.distance / 1000, source: 'osrm' };
  } catch {
    // Never let a third-party outage block an order.
    return {
      geometry: syntheticBezier(from, to),
      distanceKm: haversine(from, to),
      source: 'synthetic',
    };
  }
}
