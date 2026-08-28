'use client';
/**
 * /stores (Blueprint §14.6): list items stagger in, and hovering a row lifts
 * its map pin. One list, one map, coupled both ways.
 *
 * With twelve rooms across six cities the list is grouped by city and the map
 * flies to a city when you pick one — a flat list of twelve and a map zoomed
 * out to the whole country is a worse answer than either.
 */
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { Reveal } from '@/components/motion/Reveal';
import { CountUp } from '@/components/motion/CountUp';
import { Button } from '@/components/ui/Button';
import { haversine } from '@/lib/geo';
import { storesByCity } from '@/data/stores';
import type { Store } from '@/domain/types';

const MapCanvas = dynamic(() => import('@/components/map/MapCanvas'), {
  ssr: false,
  loading: () => <div className="skeleton" style={{ width: '100%', height: '100%' }} />,
});

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function openState(store: Store, now = new Date()) {
  const hours = store.hours[DAYS[now.getDay()]];
  if (!hours) return { open: false, label: 'Closed today' };
  const [from, to] = hours;
  const mins = now.getHours() * 60 + now.getMinutes();
  const toMins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const open = mins >= toMins(from) && mins < toMins(to);
  return { open, label: open ? `Open until ${to}` : `Opens ${from}` };
}

/** Centre and zoom that frame a set of stores without a fitBounds round trip. */
function frame(stores: Store[]) {
  const lat = stores.reduce((a, s) => a + s.lat, 0) / stores.length;
  const lng = stores.reduce((a, s) => a + s.lng, 0) / stores.length;
  return { lat, lng };
}

export function StoreLocator({ stores }: { stores: Store[] }) {
  const groups = useMemo(() => storesByCity(stores), [stores]);
  const [city, setCity] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [near, setNear] = useState<{ lat: number; lng: number } | null>(null);

  const visibleGroups = useMemo(
    () => (city ? groups.filter((g) => g.name === city) : groups),
    [groups, city],
  );

  const listed = useMemo(() => {
    const flat = visibleGroups.flatMap((g) => g.stores);
    if (!near) return flat;
    return [...flat].sort(
      (a, b) =>
        haversine(near, { lat: a.lat, lng: a.lng }) - haversine(near, { lat: b.lat, lng: b.lng }),
    );
  }, [visibleGroups, near]);

  const markers = useMemo(
    () =>
      stores.map((s) => ({
        id: s.id,
        lat: s.lat,
        lng: s.lng,
        kind: 'store' as const,
        label: `${s.name} · ${s.city}`,
        active: s.id === (hovered ?? active),
      })),
    [stores, hovered, active],
  );

  const focused = stores.find((s) => s.id === active);
  const cityFocus = city ? frame(stores.filter((s) => s.city === city)) : null;

  return (
    <div className="stores-layout">
      <div className="stack">
        <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
          <button className="chip" data-active={city === null || undefined} onClick={() => { setCity(null); setActive(null); }}>
            All {stores.length}
          </button>
          {groups.map((g) => (
            <button
              key={g.slug}
              className="chip"
              data-active={city === g.name || undefined}
              onClick={() => { setCity(g.name); setActive(null); }}
              title={g.note}
            >
              {g.name}
              <span className="mono" style={{ opacity: 0.65 }}>{g.stores.length}</span>
            </button>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          style={{ alignSelf: 'flex-start' }}
          onClick={() =>
            navigator.geolocation?.getCurrentPosition(
              (p) => setNear({ lat: p.coords.latitude, lng: p.coords.longitude }),
              () => setNear(null),
            )
          }
        >
          {near ? 'Sorted by nearest' : 'Sort by nearest'}
        </Button>

        {near ? null : (
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            {city ? groups.find((g) => g.name === city)?.note : 'Six cities, twelve rooms, one roastery.'}
          </p>
        )}

        <Reveal key={`${city}-${near ? 'near' : 'city'}`} variant="slide" stagger={0.05} className="stack">
          {listed.map((s) => {
            const state = openState(s);
            return (
              <article
                key={s.id}
                className="store-row"
                data-active={s.id === active || undefined}
                onMouseEnter={() => setHovered(s.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setActive(s.id)}
                onFocus={() => setHovered(s.id)}
                onBlur={() => setHovered(null)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActive(s.id);
                  }
                }}
              >
                <div className="row-between">
                  <h2 style={{ fontSize: 'var(--text-lg)' }}>
                    {s.name}
                    <span className="store-row__city mono">{s.city}</span>
                  </h2>
                  <span
                    className="badge"
                    style={{ color: state.open ? 'var(--verdant-500)' : 'var(--smoke-400)' }}
                  >
                    {state.open ? '● ' : '○ '}
                    {state.label}
                  </span>
                </div>
                <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                  {s.address}
                </p>
                <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                  {s.blurb}
                </p>
                <div className="row wrap" style={{ gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                  <a className="link-arrow" href={`tel:${s.phone.replace(/\s/g, '')}`}>
                    {s.phone}
                  </a>
                  {near ? (
                    <span className="mono muted" style={{ fontSize: 'var(--text-xs)' }}>
                      {haversine(near, { lat: s.lat, lng: s.lng }).toFixed(1)} km away
                    </span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </Reveal>
      </div>

      {/* Box reserved before Leaflet loads (§16.2). */}
      <div className="stores-map">
        <MapCanvas
          center={{ lat: 20.6, lng: 78.5 }}
          zoom={4}
          markers={markers}
          fitAll={!city && !focused}
          focus={focused ? { lat: focused.lat, lng: focused.lng } : cityFocus}
          focusZoom={focused ? 15 : 11}
          onSelect={(id) => {
            const s = stores.find((x) => x.id === id);
            if (s) setCity(s.city);
            setActive(id);
          }}
          ariaLabel="Map of Aura Toast bars across India"
        />
        <div className="stores-map__stat mono">
          <CountUp value={stores.length} duration={0.9} /> rooms ·{' '}
          <CountUp value={groups.length} duration={0.9} /> cities
        </div>
      </div>
    </div>
  );
}
