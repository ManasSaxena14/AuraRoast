'use client';
/**
 * /origins — the horizontal pinned section (Blueprint §14.6).
 *
 * The whole idea of the page: the map and the scroll are COUPLED. As each
 * story crosses centre, the map eases `flyTo` that origin's coordinates. It is
 * one gesture driving two things, which is why it reads as a place rather than
 * a list.
 *
 * Below 640px horizontal pinning is disabled entirely — it falls back to a
 * scroll-snap carousel. Pinned horizontal scroll on a phone is a usability
 * trap, not a fallback.
 */
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { HorizontalScroll } from '@/components/motion/HorizontalScroll';
import { ImageReveal } from '@/components/motion/ImageReveal';
import { Marquee } from '@/components/motion/Marquee';
import { Reveal } from '@/components/motion/Reveal';
import { Halo } from '@/components/motion/Halo';
import type { Drink, Origin } from '@/domain/types';

const MapCanvas = dynamic(() => import('@/components/map/MapCanvas'), {
  ssr: false,
  loading: () => <div className="skeleton" style={{ position: 'absolute', inset: 0 }} />,
});

export function OriginsExperience({
  origins,
  drinks,
  initialFocus,
}: {
  origins: Origin[];
  drinks: Drink[];
  initialFocus?: string;
}) {
  const startIndex = Math.max(
    0,
    origins.findIndex((o) => o.slug === initialFocus),
  );
  const [active, setActive] = useState(startIndex);
  // The map opens on the overview and only flies once the guest has actually
  // moved — either by scrolling the stories, tapping a pin, or arriving with
  // ?focus= in the URL. Flying on mount throws away the one frame that
  // explains what the page is.
  const [engaged, setEngaged] = useState(Boolean(initialFocus));

  const markers = useMemo(
    () =>
      origins.map((o, i) => ({
        id: o.slug,
        lat: o.lat,
        lng: o.lng,
        kind: 'origin' as const,
        label: o.name.split(',')[0],
        active: i === active,
      })),
    [origins, active],
  );

  const focus =
    engaged && origins[active] ? { lat: origins[active].lat, lng: origins[active].lng } : null;

  const onProgress = useCallback((index: number) => {
    setEngaged(true);
    setActive(index);
  }, []);

  const select = useCallback((index: number) => {
    setEngaged(true);
    setActive(index);
  }, []);

  // Mobile: the carousel drives the same coupling via scroll-snap position.
  useEffect(() => {
    const track = document.querySelector<HTMLElement>('.origins-track');
    if (!track) return;
    if (window.innerWidth >= 640) return;
    const onScroll = () => {
      const idx = Math.round(track.scrollLeft / (track.scrollWidth / origins.length));
      setEngaged(true);
      setActive(Math.min(origins.length - 1, Math.max(0, idx)));
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    return () => track.removeEventListener('scroll', onScroll);
  }, [origins.length]);

  return (
    <>
      <section className="origins-map">
        <MapCanvas
          center={{ lat: 13.2, lng: 77.5 }}
          zoom={6}
          markers={markers}
          focus={focus}
          focusZoom={9}
          onSelect={(id) => select(origins.findIndex((o) => o.slug === id))}
          ariaLabel="Map of the five origins"
        />
        <div className="origins-map__overlay">
          <div className="shell">
            <p className="eyebrow">Pure origin</p>
            <h1>Five hillsides, and the people on them.</h1>
            <p className="lede">
              Every bag we sell names a farm, an altitude and a process. Scroll — the map follows.
            </p>
          </div>
        </div>
        <div className="origins-map__legend mono">
          {origins.map((o, i) => (
            <button
              key={o.slug}
              onClick={() => select(i)}
              data-active={i === active || undefined}
              className="origins-map__legend-item"
            >
              {o.name.split(',')[0]}
            </button>
          ))}
        </div>
      </section>

      <HorizontalScroll itemCount={origins.length} onProgress={onProgress} className="origins-hscroll">
        {origins.map((o, i) => {
          const fromHere = drinks.filter((d) => d.originId === o.id);
          return (
            <article
              key={o.slug}
              className="origin-panel"
              data-active={i === active || undefined}
              id={`origin-${o.slug}`}
            >
              <div className="row-between">
                <p className="eyebrow" style={{ marginBottom: 0 }}>
                  {String(i + 1).padStart(2, '0')} / {String(origins.length).padStart(2, '0')}
                </p>
                <Halo size={34} stroke={1.4} progress={(i + 1) / origins.length} animateOnMount={false} />
              </div>

              <ImageReveal direction={i % 2 ? 'right' : 'left'} drift={0.05} className="origin-panel__media">
                <Image
                  src={o.heroImage}
                  alt=""
                  width={1200}
                  height={800}
                  sizes="(max-width: 639px) 86vw, 560px"
                />
              </ImageReveal>

              <h2 style={{ fontSize: 'var(--text-xl)' }}>{o.name}</h2>
              <p className="muted">{o.farmerStory}</p>

              <dl className="origin-panel__facts">
                <div className="origin-panel__fact">
                  <strong>Grower</strong>
                  {o.farmerName}
                </div>
                <div className="origin-panel__fact">
                  <strong>Altitude</strong>
                  {o.altitudeM}m
                </div>
                <div className="origin-panel__fact">
                  <strong>Process</strong>
                  {o.process}
                </div>
                <div className="origin-panel__fact">
                  <strong>Harvest</strong>
                  {o.harvest}
                </div>
              </dl>

              {fromHere.length ? (
                <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
                  {fromHere.slice(0, 3).map((d) => (
                    <Link key={d.id} href={`/menu/${d.slug}`} className="chip">
                      {d.name}
                    </Link>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </HorizontalScroll>

      <div className="origins-ticker">
        <Marquee speed={30}>
          {origins.map((o) => (
            <span className="marquee__item" data-ghost key={`t-${o.slug}`}>
              {o.name.split(',')[0]}
              <i className="marquee__dot" />
            </span>
          ))}
        </Marquee>
      </div>

      <section className="section" data-skew>
        <div className="shell shell--narrow">
          <Reveal variant="rise" className="stack">
            <p className="eyebrow">Traceability, plainly</p>
            <h2>Every bag carries a roast date, not a best-before.</h2>
            <p className="lede">
              Coffee does not expire. It stops being interesting, and the only honest way to say
              when is to tell you the day it was roasted and let you decide.
            </p>
            <div className="row">
              <Link href="/menu?category=beans" className="btn btn--primary">
                Take a hillside home
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
