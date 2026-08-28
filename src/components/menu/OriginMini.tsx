'use client';
/**
 * The origin block cross-fades in with a mini Leaflet map that ONLY
 * initializes when it enters the viewport (§14.6) — a map component mounted
 * off-screen is a wasted 40KB and a wasted tile fetch.
 */
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Reveal } from '@/components/motion/Reveal';
import type { Origin } from '@/domain/types';

const MapCanvas = dynamic(() => import('@/components/map/MapCanvas'), { ssr: false });

export function OriginMini({ origin }: { origin: Origin }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Reveal variant="fade" delay={0.1}>
      <div className="card" style={{ marginTop: 'var(--space-6)' }} ref={ref}>
        <div className="row-between" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="stack-sm">
            <p className="eyebrow" style={{ marginBottom: 0 }}>
              Grown at
            </p>
            <h3 style={{ fontSize: 'var(--text-lg)' }}>{origin.name}</h3>
          </div>
          <Link href={`/origins?focus=${origin.slug}`} className="link-arrow">
            The story <span aria-hidden="true">→</span>
          </Link>
        </div>

        {/* The box is reserved before Leaflet loads — the CLS rule (§16.2). */}
        <div style={{ aspectRatio: '16 / 9', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--roast-900)' }}>
          {inView ? (
            <MapCanvas
              center={{ lat: origin.lat, lng: origin.lng }}
              zoom={9}
              interactive={false}
              markers={[{ id: origin.id, lat: origin.lat, lng: origin.lng, kind: 'origin', active: true }]}
              ariaLabel={`Map showing ${origin.name}`}
            />
          ) : null}
        </div>

        <dl className="origin-panel__facts" style={{ marginTop: 'var(--space-4)' }}>
          <div className="origin-panel__fact">
            <strong>Altitude</strong>
            {origin.altitudeM}m
          </div>
          <div className="origin-panel__fact">
            <strong>Process</strong>
            {origin.process}
          </div>
          <div className="origin-panel__fact">
            <strong>Varietal</strong>
            {origin.varietal}
          </div>
          <div className="origin-panel__fact">
            <strong>Grower</strong>
            {origin.farmerName}
          </div>
        </dl>
      </div>
    </Reveal>
  );
}
