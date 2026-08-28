import type { LatLng, RouteGeometry } from '@/domain/types';

const R_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversine(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Cumulative segment lengths, so interpolation is by DISTANCE not by index. */
function cumulative(route: RouteGeometry): { totals: number[]; length: number } {
  const totals: number[] = [0];
  let length = 0;
  for (let i = 1; i < route.coordinates.length; i++) {
    const [plng, plat] = route.coordinates[i - 1];
    const [lng, lat] = route.coordinates[i];
    length += haversine({ lat: plat, lng: plng }, { lat, lng });
    totals.push(length);
  }
  return { totals, length };
}

/**
 * Position at fraction `t` (0–1) along a route, measured by real distance.
 * Index-based interpolation makes a courier crawl through dense polyline
 * clusters and sprint across sparse ones — this does not.
 */
export function interpolateAlongRoute(
  route: RouteGeometry | null,
  t: number,
): LatLng | null {
  if (!route || route.coordinates.length === 0) return null;
  if (route.coordinates.length === 1) {
    const [lng, lat] = route.coordinates[0];
    return { lat, lng };
  }
  const clamped = Math.min(1, Math.max(0, t));
  const { totals, length } = cumulative(route);
  if (length === 0) {
    const [lng, lat] = route.coordinates[0];
    return { lat, lng };
  }
  const target = clamped * length;

  let i = 1;
  while (i < totals.length - 1 && totals[i] < target) i++;

  const segStart = totals[i - 1];
  const segLen = totals[i] - segStart || 1;
  const k = (target - segStart) / segLen;

  const [alng, alat] = route.coordinates[i - 1];
  const [blng, blat] = route.coordinates[i];
  return { lat: alat + (blat - alat) * k, lng: alng + (blng - alng) * k };
}

/** The portion of the route already travelled — drawn in --aura-500. */
export function sliceRoute(route: RouteGeometry | null, t: number): [number, number][] {
  if (!route) return [];
  const clamped = Math.min(1, Math.max(0, t));
  const { totals, length } = cumulative(route);
  if (length === 0) return route.coordinates.slice(0, 1);
  const target = clamped * length;
  const out: [number, number][] = [];
  for (let i = 0; i < totals.length; i++) {
    if (totals[i] <= target) out.push(route.coordinates[i]);
    else break;
  }
  const head = interpolateAlongRoute(route, clamped);
  if (head) out.push([head.lng, head.lat]);
  return out;
}

/**
 * A plausible curved path between two points, used when OSRM is unreachable.
 * A quadratic bezier with a perpendicular offset reads as a road, where a
 * straight line reads as a bug.
 */
export function syntheticBezier(from: LatLng, to: LatLng, steps = 64): RouteGeometry {
  const mx = (from.lng + to.lng) / 2;
  const my = (from.lat + to.lat) / 2;
  const dx = to.lng - from.lng;
  const dy = to.lat - from.lat;
  const cx = mx - dy * 0.16;
  const cy = my + dx * 0.16;

  const coordinates: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    coordinates.push([
      u * u * from.lng + 2 * u * t * cx + t * t * to.lng,
      u * u * from.lat + 2 * u * t * cy + t * t * to.lat,
    ]);
  }
  return { type: 'LineString', coordinates };
}

export function bbox(points: readonly LatLng[]): [[number, number], [number, number]] {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
}

export function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
}
