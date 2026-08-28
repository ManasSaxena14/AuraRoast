'use client';
/**
 * ONE Leaflet component, three call sites: tracking, origins, stores (§2.2).
 *
 * Free stack only (Part 6): OpenStreetMap data, CARTO Dark tiles, no API key,
 * no billing account. Attribution is visible on every instance — that is a
 * licence requirement, not a nicety.
 *
 * `preferCanvas: true` and marker movement as a requestAnimationFrame
 * transform, never `setInterval` + `setLatLng` (§16.3).
 */
import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap, Marker, Polyline } from 'leaflet';
import type { LatLng } from '@/domain/types';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  kind: 'store' | 'origin' | 'courier' | 'destination';
  label?: string;
  active?: boolean;
}

export interface MapCanvasProps {
  center: LatLng;
  zoom?: number;
  markers: MapMarker[];
  route?: [number, number][]; // [lng, lat] — GeoJSON order
  travelled?: [number, number][];
  /** Eased flyTo when this changes — the /origins coupling (§14.6). */
  focus?: LatLng | null;
  focusZoom?: number;
  fitAll?: boolean;
  className?: string;
  onSelect?: (id: string) => void;
  interactive?: boolean;
  ariaLabel: string;
}

export default function MapCanvas({
  center,
  zoom = 12,
  markers,
  route,
  travelled,
  focus,
  focusZoom = 7,
  fitAll = false,
  className,
  onSelect,
  interactive = true,
  ariaLabel,
}: MapCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRefs = useRef<Map<string, Marker>>(new Map());
  const routeRef = useRef<Polyline | null>(null);
  const travelledRef = useRef<Polyline | null>(null);
  const rafRef = useRef(0);
  const resizeObs = useRef<ResizeObserver | null>(null);
  const Lref = useRef<typeof import('leaflet') | null>(null);
  // Leaflet is a dynamic import inside an async effect, so every effect that
  // touches the map must wait for it. Without this flag the marker effect runs
  // once, finds no map, returns — and no marker ever appears.
  const [ready, setReady] = useState(false);

  /* ── Init ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !hostRef.current || mapRef.current) return;
      Lref.current = L;

      const map = L.map(hostRef.current, {
        center: [center.lat, center.lng],
        zoom,
        preferCanvas: true,
        zoomControl: interactive,
        dragging: interactive,
        scrollWheelZoom: false, // never steal the page scroll
        attributionControl: true,
      });
      mapRef.current = map;

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      map.getContainer().setAttribute('role', 'application');
      map.getContainer().setAttribute('aria-label', ariaLabel);

      // Leaflet caches the container size at init. If the host is still
      // settling — fonts, a sticky layout, a dynamic import landing before its
      // CSS — the map keeps loading tiles for the wrong box and renders one
      // narrow column. Watching the host is the only reliable fix.
      const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
      ro.observe(map.getContainer());
      resizeObs.current = ro;
      requestAnimationFrame(() => map.invalidateSize({ animate: false }));
      void document.fonts?.ready.then(() => map.invalidateSize({ animate: false }));
      setReady(true);
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      resizeObs.current?.disconnect();
      resizeObs.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRefs.current.clear();
      routeRef.current = null;
      travelledRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Markers ──────────────────────────────────────────────────────── */
  useEffect(() => {
    const L = Lref.current;
    const map = mapRef.current;
    if (!L || !map) return;

    const seen = new Set<string>();

    markers.forEach((m, i) => {
      seen.add(m.id);
      const existing = markerRefs.current.get(m.id);

      if (existing) {
        if (m.kind === 'courier') {
          // Eased continuously between polls, LINEARLY — the poll IS the
          // timing function (§7.5). No easing curve here on purpose.
          animateMarker(existing, L.latLng(m.lat, m.lng));
        } else {
          existing.setLatLng([m.lat, m.lng]);
        }
        const el = existing.getElement();
        if (el) el.dataset.active = m.active ? 'true' : 'false';
        return;
      }

      const icon = L.divIcon({
        className: `map-pin map-pin--${m.kind}`,
        html: `<span class="map-pin__dot"></span><span class="map-pin__bloom"></span>${
          m.label ? `<span class="map-pin__label">${escapeHtml(m.label)}</span>` : ''
        }`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const marker = L.marker([m.lat, m.lng], {
        icon,
        keyboard: Boolean(onSelect),
        title: m.label,
      }).addTo(map);

      const el = marker.getElement();
      if (el) {
        el.dataset.active = m.active ? 'true' : 'false';
        // Origin pins drop with a 60ms stagger under --ease-bloom (§14.6).
        el.style.setProperty('--pin-delay', `${i * 60}ms`);
      }
      if (onSelect) marker.on('click', () => onSelect(m.id));
      markerRefs.current.set(m.id, marker);
    });

    for (const [id, marker] of markerRefs.current) {
      if (!seen.has(id)) {
        marker.remove();
        markerRefs.current.delete(id);
      }
    }
  }, [markers, onSelect, ready]);

  /* ── Route polylines ──────────────────────────────────────────────── */
  useEffect(() => {
    const L = Lref.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (route?.length) {
      const latlngs = route.map(([lng, lat]) => [lat, lng] as [number, number]);
      if (routeRef.current) routeRef.current.setLatLngs(latlngs);
      else {
        // The untravelled route needs to read against a near-black basemap
        // without competing with the travelled portion — hence a lighter
        // stroke at low opacity rather than a dim one at high opacity.
        routeRef.current = L.polyline(latlngs, {
          color: '#f0e8da',
          weight: 3,
          opacity: 0.42,
          dashArray: '2 7',
          lineCap: 'round',
        }).addTo(map);
      }
    } else {
      routeRef.current?.remove();
      routeRef.current = null;
    }

    if (travelled?.length) {
      const latlngs = travelled.map(([lng, lat]) => [lat, lng] as [number, number]);
      if (travelledRef.current) travelledRef.current.setLatLngs(latlngs);
      else {
        travelledRef.current = L.polyline(latlngs, {
          color: '#d8a657',
          weight: 4.5,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      }
    } else {
      travelledRef.current?.remove();
      travelledRef.current = null;
    }
  }, [route, travelled, ready]);

  /* ── Fit / focus ──────────────────────────────────────────────────── */
  useEffect(() => {
    const L = Lref.current;
    const map = mapRef.current;
    if (!L || !map || !fitAll || markers.length === 0) return;
    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
    if (routeRef.current) bounds.extend(routeRef.current.getBounds());
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
  }, [fitAll, markers, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) map.setView([focus.lat, focus.lng], focusZoom, { animate: false });
    else map.flyTo([focus.lat, focus.lng], focusZoom, { duration: 1.15 });
  }, [focus, focusZoom, ready]);

  function animateMarker(marker: Marker, to: ReturnType<typeof import('leaflet').latLng>) {
    const from = marker.getLatLng();
    const start = performance.now();
    const DURATION = 2500; // matches the poll interval exactly
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const step = (t: number) => {
      const k = Math.min((t - start) / DURATION, 1); // linear — the poll IS the timing
      marker.setLatLng([from.lat + (to.lat - from.lat) * k, from.lng + (to.lng - from.lng) * k]);
      if (k < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }

  return <div ref={hostRef} className={`map-canvas${className ? ` ${className}` : ''}`} />;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}
