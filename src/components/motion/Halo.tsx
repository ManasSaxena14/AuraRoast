'use client';
/**
 * The Halo (Blueprint §1.3) — a thin amber arc with a soft outer bloom that
 * closes into a full circle. It appears exactly five times, each carrying real
 * meaning: hero close, loyalty tiers, order tracking, focus states, page
 * transitions. A sixth use that does not communicate state does not ship.
 *
 * THE implementation rule: the bloom is a PRE-BLURRED layer whose opacity
 * animates, never a live-animated `filter: blur()` radius. Animating a blur
 * radius is a per-frame paint; animating the opacity of an already-blurred
 * layer is a compositor operation. That distinction is 60fps versus 24fps.
 */
import { useEffect, useId, useRef } from 'react';
import { EASE, gsap, prefersReducedMotion, useGSAP } from './gsap';

export interface HaloProps {
  /** 0–1. The arc sweeps clockwise from 12 o'clock. */
  progress?: number;
  size?: number;
  stroke?: number;
  /** Quadrant ticks — the loyalty tiers ARE the four quadrants (§1.3 #2). */
  quadrants?: boolean;
  activeQuadrant?: number;
  /** Indeterminate: the chat "thinking" state. */
  spinning?: boolean;
  label?: string;
  className?: string;
  /** Marks this instance as the shared element carried across routes. */
  shared?: boolean;
  animateOnMount?: boolean;
  children?: React.ReactNode;
}

export function Halo({
  progress = 1,
  size = 160,
  stroke = 2,
  quadrants = false,
  activeQuadrant = 0,
  spinning = false,
  label,
  className,
  shared = false,
  animateOnMount = true,
  children,
}: HaloProps) {
  const uid = useId().replace(/:/g, '');
  const arcRef = useRef<SVGCircleElement>(null);
  const bloomRef = useRef<SVGCircleElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const r = (size - stroke * 2 - 8) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, progress));

  useGSAP(
    () => {
      const arc = arcRef.current;
      const bloom = bloomRef.current;
      if (!arc || !bloom) return;

      const reduced = prefersReducedMotion();
      const target = c * (1 - clamped);

      if (reduced) {
        // Halo progress still updates — it just jumps rather than sweeping.
        gsap.set([arc, bloom], { strokeDashoffset: target });
        gsap.set(bloom, { opacity: 0.5 * clamped });
        return;
      }

      gsap.to([arc, bloom], {
        strokeDashoffset: target,
        duration: animateOnMount ? 0.9 : 0.6,
        ease: EASE.aura,
        overwrite: 'auto',
      });
      // The bloom's OPACITY animates. Its blur is baked into the filter and
      // never touched.
      gsap.to(bloom, { opacity: 0.55 * clamped, duration: 0.6, ease: EASE.aura, overwrite: 'auto' });
    },
    { scope: rootRef, dependencies: [clamped, c, animateOnMount] },
  );

  // A --ease-bloom pulse the moment the ring closes.
  const closedRef = useRef(false);
  useEffect(() => {
    if (clamped < 0.999 || closedRef.current || prefersReducedMotion()) return;
    closedRef.current = true;
    if (!rootRef.current) return;
    gsap.fromTo(
      rootRef.current,
      { scale: 1 },
      { scale: 1.035, duration: 0.34, ease: EASE.bloom, yoyo: true, repeat: 1 },
    );
  }, [clamped]);

  return (
    <div
      ref={rootRef}
      className={`halo${shared ? ' order-halo' : ''}${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className={spinning ? 'halo-spin' : undefined}
        aria-hidden="true"
      >
        <defs>
          <filter id={`bloom-${uid}`} x="-60%" y="-60%" width="220%" height="220%">
            {/* Pre-blurred once. The radius is never animated. */}
            <feGaussianBlur stdDeviation={Math.max(3, stroke * 3)} />
          </filter>
        </defs>

        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--aura-500)"
          strokeWidth={stroke}
          opacity={0.12}
        />

        {/* Bloom — the thing that makes it "aura" and not "ring" */}
        <circle
          ref={bloomRef}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--aura-300)"
          strokeWidth={stroke * 2.4}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c}
          filter={`url(#bloom-${uid})`}
          opacity={0}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />

        {/* The arc itself */}
        <circle
          ref={arcRef}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--aura-500)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />

        {quadrants &&
          [0, 1, 2, 3].map((q) => {
            const angle = (q * 90 - 90) * (Math.PI / 180);
            const x = size / 2 + Math.cos(angle) * r;
            const y = size / 2 + Math.sin(angle) * r;
            return (
              <circle
                key={q}
                cx={x}
                cy={y}
                r={stroke * 1.8}
                fill={q < activeQuadrant ? 'var(--aura-500)' : 'var(--roast-700)'}
                stroke="var(--aura-500)"
                strokeWidth={1}
                opacity={q < activeQuadrant ? 1 : 0.4}
              />
            );
          })}
      </svg>
      {children ? <div className="halo__inner">{children}</div> : null}
    </div>
  );
}
