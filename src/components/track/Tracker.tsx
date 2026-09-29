'use client';
/**
 * /track/[orderNumber] (Blueprint §7.4, §7.5, §13.4, §14.6).
 *
 *   · the Halo ARRIVES as the shared element from confirmation and then tracks
 *     `overallProgress` continuously — the guest never sees it disappear
 *   · the map is sticky through the timeline scroll; the courier eases
 *     LINEARLY between polls, because the poll is the timing function (§7.5)
 *   · each stage node fills as it completes and the connecting line draws
 *   · the receipt reveals on scroll-in
 *
 * The whole thing is derived from stored data on every read. There is no cron,
 * no worker, and no background job moving this order along.
 */
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatMoney } from '@/domain/money';
import { ORDER_STAGE_COPY } from '@/domain/state-machine';
import { formatEta } from '@/domain/tracking';
import { Halo } from '@/components/motion/Halo';
import { Reveal } from '@/components/motion/Reveal';
import { NumberRoll } from '@/components/motion/NumberRoll';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { toast } from '@/components/toast/ToastProvider';
import { contactFor } from '@/lib/device-orders';
import type { Order, OrderStatus, PaymentStatus } from '@/domain/types';

const MapCanvas = dynamic(() => import('@/components/map/MapCanvas'), {
  ssr: false,
  loading: () => <div className="skeleton" style={{ width: '100%', height: '100%' }} />,
});

const POLL_MS = 2500;

interface TrackPayload {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  plan: { totalDurationMs: number; distanceKm: number } | null;
  state: {
    currentStage: OrderStatus;
    overallProgress: number;
    stageProgress: number;
    courierPosition: { lat: number; lng: number } | null;
    travelledFraction: number;
    etaMs: number | null;
    stages: { name: OrderStatus; done: boolean; active: boolean; startsAtMs: number }[];
  };
  travelled: [number, number][];
  route: [number, number][];
  routeSource: string | null;
  store: { name: string; lat: number; lng: number } | null;
  destination: { lat: number; lng: number } | null;
}

export function Tracker({
  order: initial,
  initialState,
  ownedBySession = false,
}: {
  /** The shareable view: no email, and only the tail of the phone. */
  order: Order;
  /**
   * The derived state, computed on the server for the first paint. Nothing ever
   * advances the stored `status` column, so falling back to it paints "Order
   * received / 0 %" for an order that was delivered an hour ago (§7.4).
   */
  initialState?: TrackPayload['state'];
  /** The signed-in account placed this order, so the server will take its word. */
  ownedBySession?: boolean;
}) {
  const [order, setOrder] = useState(initial);
  const [data, setData] = useState<TrackPayload | null>(null);
  const [cancelling, setCancelling] = useState(false);
  /**
   * The proof for cancelling: the contact given at checkout, remembered by
   * the device that placed the order. Read after mount — localStorage does not
   * exist on the server. Without it (a shared link, another device) the guest
   * is asked for it, unless their signed-in session already owns the order.
   */
  const [proof, setProof] = useState<string | null>(null);
  const [askProof, setAskProof] = useState(false);
  const [proofInput, setProofInput] = useState('');
  useEffect(() => setProof(contactFor(initial.orderNumber)), [initial.orderNumber]);
  /**
   * The poll lands every 2.5s, but an ETA that only moves every 2.5s reads as
   * broken. `tick` re-renders once a second so the countdown counts, while the
   * authoritative value still only ever comes from the server.
   */
  const [tick, setTick] = useState(0);
  /**
   * Time-derived values must not differ between the server render and the
   * first client render, or React reports a hydration mismatch. Interpolation
   * only switches on after mount; until then both sides agree on the raw
   * server value.
   */
  const [mounted, setMounted] = useState(false);
  const [justAdvanced, setJustAdvanced] = useState(false);
  const lastStage = useRef<string | null>(null);
  const lastPollAt = useRef<number>(Date.now());

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${initial.orderNumber}/track`, { cache: 'no-store' });
      if (!res.ok) return;
      const next = (await res.json()) as TrackPayload;
      lastPollAt.current = Date.now();
      // A stage boundary is the one moment on this page worth marking.
      if (lastStage.current && lastStage.current !== next.state.currentStage) {
        setJustAdvanced(true);
        setTimeout(() => setJustAdvanced(false), 1600);
      }
      lastStage.current = next.state.currentStage;
      setData(next);
    } catch {
      /* a dropped poll is not an error state — the next one will land */
    }
  }, [initial.orderNumber]);

  // Live status: a UPI order can be verified, or a tab elsewhere can cancel,
  // while this page is open — the poll is the truth, the first paint is not.
  const status = order.status === 'cancelled' ? 'cancelled' : (data?.status ?? order.status);
  const state = data?.state ?? initialState;
  const stage = state?.currentStage ?? status;
  const settled = status === 'cancelled' || stage === 'delivered';

  useEffect(() => {
    // Nothing moves once it is delivered or cancelled, and nothing needs
    // watching in a tab nobody is looking at — each poll is a server request.
    if (settled) return;
    let id: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      if (id !== undefined || document.hidden) return;
      void poll();
      id = setInterval(poll, POLL_MS);
    };
    const stop = () => {
      if (id !== undefined) clearInterval(id);
      id = undefined;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [poll, settled]);

  // A delivered or cancelled order is never polled, but its map still needs
  // the route and the pins once.
  useEffect(() => {
    if (settled && !data) void poll();
  }, [settled, data, poll]);

  useEffect(() => setMounted(true), []);

  // One-second heartbeat for the countdown only — and only while it counts.
  useEffect(() => {
    if (settled) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [settled]);

  // Interpolate between polls so the ring and the clock both move continuously.
  const sincePoll = mounted && tick >= 0 ? Date.now() - lastPollAt.current : 0;
  const planMs = data?.plan?.totalDurationMs ?? order.deliveryPlan?.totalDurationMs ?? 0;
  const rawProgress = state?.overallProgress ?? 0;
  const progress =
    planMs > 0 && rawProgress < 1
      ? Math.min(1, rawProgress + sincePoll / planMs)
      : rawProgress;
  const etaMs =
    state?.etaMs != null ? Math.max(0, state.etaMs - sincePoll) : null;

  const distanceKm = data?.plan?.distanceKm ?? order.deliveryPlan?.distanceKm ?? 0;
  const travelled = state?.travelledFraction ?? 0;
  const remainingKm = Math.max(0, distanceKm * (1 - travelled));

  const markers = [
    ...(data?.store
      ? [{ id: 'store', lat: data.store.lat, lng: data.store.lng, kind: 'store' as const, label: data.store.name }]
      : []),
    ...(data?.destination
      ? [{ id: 'dest', lat: data.destination.lat, lng: data.destination.lng, kind: 'destination' as const, label: 'You' }]
      : []),
    ...(state?.courierPosition && state.travelledFraction > 0
      ? [
          {
            id: 'courier',
            lat: state.courierPosition.lat,
            lng: state.courierPosition.lng,
            kind: 'courier' as const,
            active: true,
          },
        ]
      : []),
  ];

  async function cancel(withProof: string | null = proof) {
    if (!withProof && !ownedBySession) {
      setAskProof(true);
      return;
    }
    if (!window.confirm(`Cancel ${order.orderNumber}? Nothing has been charged.`)) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/orders/${order.orderNumber}/cancel`, {
        method: 'POST',
        headers: withProof ? { 'X-Aura-Contact': withProof } : undefined,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        // A 404 on a page that just rendered the order means the proof was wrong.
        toast(
          res.status === 404
            ? 'That is not the email or phone this order was placed with.'
            : (body.error ?? 'Could not cancel.'),
          'error',
        );
        if (res.status === 404) setAskProof(true);
        return;
      }
      setOrder(body.order);
      setAskProof(false);
      toast('Cancelled. Nothing was charged.', 'success');
      void poll();
    } catch {
      toast('The connection dropped — the order was not cancelled.', 'error');
    } finally {
      setCancelling(false);
    }
  }

  /**
   * Only the DERIVED stage may decide this — the server's cancel guard uses it
   * too. Until that state exists we do not know the stage, and offering the
   * button on the stale column offers an action the API answers with a 409.
   */
  const cancellable =
    state != null &&
    status !== 'cancelled' &&
    stage !== 'out_for_delivery' &&
    stage !== 'delivered';

  return (
    <div className="shell">
      <header className="page-head">
        <p className="breadcrumb">
          <Link href="/menu">Menu</Link>
          <span aria-hidden="true">/</span>
          <span>{order.orderNumber}</span>
        </p>
        <div className="row" style={{ gap: 'var(--space-5)', alignItems: 'center' }}>
          {/* The SAME Halo that closed on the confirmation page. */}
          <Halo
            size={92}
            stroke={2.5}
            progress={status === 'cancelled' ? 1 : progress}
            shared
            animateOnMount={false}
            label={`Order ${Math.round(progress * 100)}% of the way`}
          >
            <span className="mono" style={{ fontSize: 'var(--text-sm)', color: 'var(--aura-500)' }}>
              {Math.round(progress * 100)}%
            </span>
          </Halo>
          <div className="stack-sm">
            <h1 style={{ fontSize: 'var(--text-2xl)' }}>
              {ORDER_STAGE_COPY[status === 'cancelled' ? 'cancelled' : stage]?.label}
            </h1>
            <p className="muted">
              {ORDER_STAGE_COPY[status === 'cancelled' ? 'cancelled' : stage]?.detail}
            </p>
            {status !== 'cancelled' ? (
              <p className="mono track__eta" data-advanced={justAdvanced || undefined}>
                {formatEta(etaMs)} away
              </p>
            ) : null}
            {/* The heading swaps in place under the poll, which a screen reader
                would otherwise never hear. Stage copy only — the ETA re-renders
                once a second and would drown the one announcement worth making. */}
            <div aria-live="polite" aria-atomic="true" className="sr-only">
              {ORDER_STAGE_COPY[status === 'cancelled' ? 'cancelled' : stage]?.label}.{' '}
              {ORDER_STAGE_COPY[status === 'cancelled' ? 'cancelled' : stage]?.detail}
            </div>
          </div>
        </div>
      </header>

      <div className="track">
        <div className="track__sticky">
          <div className="track__map">
            <MapCanvas
              center={
                data?.store
                  ? { lat: data.store.lat, lng: data.store.lng }
                  : { lat: 12.97, lng: 77.64 }
              }
              zoom={13}
              markers={markers}
              route={data?.route}
              travelled={data?.travelled}
              fitAll
              ariaLabel="Live courier map"
            />
          </div>
          <p className="mono muted" style={{ fontSize: 10, marginTop: 'var(--space-3)' }}>
            Route from {data?.routeSource === 'osrm' ? 'OSRM road data' : 'a synthesized path'} ·
            fetched once at confirmation and stored · polling every {POLL_MS / 1000}s
          </p>
        </div>

        <div className="stack">
          {status !== 'cancelled' && travelled > 0 ? (
            <div className="track__live" data-advanced={justAdvanced || undefined}>
              <span className="track__pip" aria-hidden="true" />
              <span className="mono">
                <NumberRoll
                  value={remainingKm}
                  format={(n) => `${n.toFixed(1)} km`}
                  duration={2.4}
                />{' '}
                to go
              </span>
              <span className="muted mono">
                {Math.round(travelled * 100)}% of the route behind them
              </span>
            </div>
          ) : null}

          <div className="timeline">
            {/* A real element rather than a ::before driven by a custom
                property: the pseudo could not hold a value that changes once a
                second, and this is the same pattern the home page's step
                connector already uses. */}
            <span className="timeline__rail" aria-hidden="true">
              <i style={{ transform: `scaleY(${status === 'cancelled' ? 0 : progress})` }} />
            </span>
            {(state?.stages ?? []).map((s) => (
              <div
                key={s.name}
                className="timeline__stage"
                data-done={s.done || undefined}
                data-active={s.active || undefined}
                data-pending={!s.done && !s.active ? 'true' : undefined}
              >
                <span className="timeline__node">{s.done ? '✓' : ''}</span>
                <div className="stack-sm">
                  <span className="timeline__label">{ORDER_STAGE_COPY[s.name]?.label}</span>
                  <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                    {ORDER_STAGE_COPY[s.name]?.detail}
                  </span>
                  <span className="mono muted" style={{ fontSize: 10 }}>
                    {new Date(s.startsAtMs).toLocaleTimeString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}
            {status === 'pending_payment' ? (
              <div className="timeline__stage" data-active>
                <span className="timeline__node" />
                <div className="stack-sm">
                  <span className="timeline__label">Awaiting your UPI transfer</span>
                  <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                    A human verifies it at our end. Tracking starts the moment it clears.
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {cancellable && !askProof ? (
            <Button variant="danger" onClick={() => void cancel()} loading={cancelling}>
              Cancel this order
            </Button>
          ) : null}

          {cancellable && askProof ? (
            <form
              className="card stack-sm"
              onSubmit={(e) => {
                e.preventDefault();
                const value = proofInput.trim();
                if (value) void cancel(value);
              }}
            >
              <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                To cancel from here, confirm the email or phone number this order was placed with.
              </p>
              <Field
                label="Email or phone"
                value={proofInput}
                onChange={(e) => setProofInput(e.target.value)}
                autoComplete="email"
                required
              />
              <div className="row" style={{ gap: 'var(--space-2)' }}>
                <Button type="submit" variant="danger" size="sm" loading={cancelling}>
                  Cancel the order
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setAskProof(false)}>
                  Keep it
                </Button>
              </div>
            </form>
          ) : null}

          {order.fulfillment === 'delivery' && (order.addressLine || data?.destination) ? (
            <div className="card stack-sm" style={{ background: 'var(--roast-800)', border: 'var(--hairline)', padding: 'var(--space-4)' }}>
              <p className="eyebrow" style={{ fontSize: 10, letterSpacing: '0.08em' }}>Delivery Destination</p>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                {order.addressLine || 'Pinned location on map'}
              </p>
              {order.guestName ? (
                <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                  For {order.guestName}
                  {order.guestPhone ? ` · phone ending ${order.guestPhone.replace(/\D/g, '')}` : ''}
                </p>
              ) : null}
            </div>
          ) : null}

          <Reveal variant="rise" className="card receipt" style={{ maxWidth: 'none' }}>
            <p className="eyebrow" style={{ marginBottom: 'var(--space-4)' }}>
              Receipt
            </p>
            {order.items.map((i) => (
              <div key={i.id} className="receipt__row">
                <span>
                  {i.quantity} × {i.nameSnapshot}
                </span>
                <span className="mono">{formatMoney(i.lineTotal)}</span>
              </div>
            ))}
            <div className="receipt__row receipt__row--total">
              <span>Total</span>
              <span className="mono">{formatMoney(order.total)}</span>
            </div>
            <p className="muted" style={{ fontSize: 11, marginTop: 'var(--space-4)' }}>
              Paid by {order.paymentMethod === 'cash' ? 'cash' : 'UPI'} ·{' '}
              {order.fulfillment === 'pickup' ? 'collection' : 'delivery'} · placed{' '}
              {/* Pinned to the shop's zone: without it the server formats in
                  ITS zone and the guest's first client render disagrees. */}
              {new Date(order.placedAt).toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </Reveal>
        </div>
      </div>
      <div style={{ height: 'var(--space-10)' }} />
    </div>
  );
}
