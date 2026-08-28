'use client';
/**
 * The order-placing ceremony.
 *
 * A submit button that spins for two seconds and then teleports you to a
 * receipt tells the guest nothing. This narrates what is genuinely happening
 * on the server, in order, because each of these steps is a real thing this
 * system does:
 *
 *   1. the cart is re-priced from stored data           (§9.1)
 *   2. the idempotency key is claimed                   (§9.3)
 *   3. the address is geocoded and OSRM is called once  (§7.3)
 *   4. the order row and its delivery plan are written  (§9.5)
 *
 * Steps advance on REAL signals where there is one, and on a paced timer
 * otherwise — but the sequence never claims to be finished before the server
 * says so, and the final beat waits for the actual response.
 */
import { useEffect, useRef, useState } from 'react';
import { EASE, gsap, prefersReducedMotion, useGSAP } from '@/components/motion/gsap';
import { Halo } from '@/components/motion/Halo';

export type PlacingStage = 'pricing' | 'claiming' | 'routing' | 'writing' | 'done' | 'failed';

const STEPS: { id: PlacingStage; label: string; detail: string }[] = [
  { id: 'pricing', label: 'Re-pricing on the server', detail: 'Your total is recomputed from stored prices, not trusted from this browser.' },
  { id: 'claiming', label: 'Claiming the order key', detail: 'One key, one order — a double tap cannot buy this twice.' },
  { id: 'routing', label: 'Plotting the route', detail: 'Real road geometry, fetched once and stored for the life of the order.' },
  { id: 'writing', label: 'Writing the ticket', detail: 'Order, items and delivery plan in a single transaction.' },
];

export function PlacingOverlay({
  stage,
  error,
  orderNumber,
}: {
  stage: PlacingStage;
  error?: string | null;
  orderNumber?: string | null;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const index = STEPS.findIndex((s) => s.id === stage);
  const done = stage === 'done';
  const failed = stage === 'failed';
  const progress = failed ? 0 : done ? 1 : Math.max(0.08, (index + 1) / (STEPS.length + 1));

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const root = rootRef.current;
      if (!root) return;
      gsap.fromTo(
        root.querySelectorAll('[data-placing-step]'),
        { opacity: 0, x: -12 },
        { opacity: 1, x: 0, duration: 0.45, ease: EASE.aura, stagger: 0.06 },
      );
    },
    { scope: rootRef },
  );

  return (
    <div className="placing" role="status" aria-live="polite" ref={rootRef}>
      <div className="placing__panel">
        <Halo
          size={128}
          stroke={2.5}
          progress={progress}
          animateOnMount={false}
          label={failed ? 'Order failed' : done ? 'Order placed' : 'Placing your order'}
        >
          <span className="placing__pct mono">
            {failed ? '—' : `${Math.round(progress * 100)}%`}
          </span>
        </Halo>

        <div className="placing__steps">
          {STEPS.map((step, i) => {
            const state = failed && i === index ? 'failed' : i < index || done ? 'done' : i === index ? 'active' : 'todo';
            return (
              <div key={step.id} data-placing-step data-state={state} className="placing__step">
                <span className="placing__tick" aria-hidden="true">
                  {state === 'done' ? '✓' : state === 'failed' ? '⚠' : state === 'active' ? '◌' : ''}
                </span>
                <div>
                  <strong>{step.label}</strong>
                  <span className="muted">{step.detail}</span>
                </div>
              </div>
            );
          })}
        </div>

        <p className="placing__foot muted mono">
          {failed
            ? error ?? 'That did not go through. Nothing was charged.'
            : done
              ? `${orderNumber ?? 'Order'} confirmed`
              : 'Do not refresh — the key protects you either way.'}
        </p>
      </div>
    </div>
  );
}
