'use client';
/**
 * /checkout (Blueprint §14.6, §9.1, §9.3, Part 8).
 *
 * DELIBERATELY RESTRAINED. No parallax, no pinning, no scrub on a form — each
 * of the three sections gets a single `Reveal fade` on first mount and nothing
 * else. The one piece of motion is the total, which number-rolls whenever it
 * changes. Animating a checkout is how you lose an order.
 */
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { formatMoney } from '@/domain/money';
import { describeSelection } from '@/domain/brew-plan';
import { Reveal } from '@/components/motion/Reveal';
import { NumberRoll } from '@/components/motion/NumberRoll';
import { Button } from '@/components/ui/Button';
import { Field, SelectField, TextareaField } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/bits';
import { PlacingOverlay, type PlacingStage } from './PlacingOverlay';
import { useCart } from '@/components/cart/CartProvider';
import { storesByCity } from '@/data/stores';
import { toast } from '@/components/toast/ToastProvider';
import { haversine } from '@/lib/geo';
import type { PricedCart, Store } from '@/domain/types';

interface PaymentSettings {
  upiId: string;
  payeeName: string;
  methods: { id: 'cash' | 'upi'; label: string; detail: string; instant: boolean }[];
  note: string;
}

/**
 * One key per checkout attempt, kept across retries of the SAME order (§9.3).
 *
 * "Same" is now decided by the payload, not by the tab. The server hashes the
 * store, name, phone, address, coordinates, tip and promo as well as the lines,
 * so a guest who fixes a typo in their address and presses Place again would
 * otherwise send the cached key with a different body and get a permanent 422
 * idempotency_conflict. Re-minting when the signature changes keeps the replay
 * protection for a genuine retry and drops it for a genuinely different order.
 */
function idempotencyKey(signature: string): string {
  try {
    const cached = sessionStorage.getItem('aura.idem');
    if (cached) {
      const parsed = JSON.parse(cached) as { key?: string; sig?: string };
      if (parsed.key && parsed.sig === signature) return parsed.key;
    }
  } catch {
    /* a corrupt entry just means we mint a fresh key */
  }
  const key = crypto.randomUUID();
  try {
    sessionStorage.setItem('aura.idem', JSON.stringify({ key, sig: signature }));
  } catch {
    /* private mode — the key still protects this attempt */
  }
  return key;
}

function findNearestStore(stores: Store[], lat: number, lng: number): Store | null {
  let best: Store | null = null;
  let bestDist = Infinity;
  for (const s of stores) {
    const d = haversine({ lat, lng }, { lat: s.lat, lng: s.lng });
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return best;
}

export function Checkout({ stores, payment }: { stores: Store[]; payment: PaymentSettings }) {
  const router = useRouter();
  const { lines, priced, fulfillment, setFulfillment, promoCode, setPromoCode, tip, setTip, clear, hydrated } =
    useCart();

  const [method, setMethod] = useState<'cash' | 'upi'>('cash');
  const [storeId, setStoreId] = useState<string>(stores[0]?.id ?? '');
  const [nearestLabel, setNearestLabel] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [promoInput, setPromoInput] = useState(promoCode ?? '');
  const [server, setServer] = useState<PricedCart | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<PlacingStage | null>(null);
  const [placed, setPlaced] = useState<string | null>(null);

  /* The server re-prices the cart before checkout is ever shown (§9.1). */
  useEffect(() => {
    if (!hydrated || lines.length === 0) return;
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/orders/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines, fulfillment, tip, promoCode }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as PricedCart;
      if (!cancelled) setServer(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [lines, fulfillment, tip, promoCode, hydrated]);

  /* Nearest-outlet detection: geolocate → haversine → pick closest store.
     Fallback: localStorage last-used → first store in list. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDetecting(true);
      // 1. Check localStorage for a previously saved store preference
      try {
        const saved = localStorage.getItem('aura.store');
        if (saved && stores.some((s) => s.id === saved)) {
          if (!cancelled) {
            setStoreId(saved);
            setNearestLabel(null);
            setDetecting(false);
            return;
          }
        }
      } catch { /* localStorage unavailable */ }

      // 2. Try browser geolocation
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (!navigator.geolocation) reject(new Error('No geolocation'));
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 300000,
          });
        });
        if (cancelled) return;
        const nearest = findNearestStore(stores, pos.coords.latitude, pos.coords.longitude);
        if (nearest) {
          setStoreId(nearest.id);
          setNearestLabel(`Nearest: ${nearest.name}`);
          localStorage.setItem('aura.store', nearest.id);
        }
      } catch {
        // 3. Fall back to first store (same as original behaviour)
        setNearestLabel(null);
      } finally {
        if (!cancelled) setDetecting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [stores]);

  const totals = server ?? priced;
  const store = useMemo(() => stores.find((s) => s.id === storeId), [stores, storeId]);
  const cityGroups = useMemo(() => storesByCity(stores), [stores]);

  const handleStoreChange = useCallback((id: string) => {
    setStoreId(id);
    try { localStorage.setItem('aura.store', id); } catch { /* unavailable */ }
  }, []);

  const place = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setBusy(true);
      setError(null);
      setPlaced(null);

      // The overlay narrates the real sequence. Each beat is held briefly so
      // it is readable, but the LAST beat waits on the actual response — the
      // ceremony never claims success the server has not given.
      const beat = (ms: number) => new Promise((r) => setTimeout(r, ms));

      try {
        setStage('pricing');
        await beat(420);

        setStage('claiming');
        await beat(360);

        setStage('routing');
        let deliveryLat: number | undefined;
        let deliveryLng: number | undefined;
        if (fulfillment === 'delivery' && address.trim()) {
          try {
            // Scope the lookup to the chosen bar's city — "12 Church St" is a
            // real address in four of the six cities we now serve.
            const scoped = `${address}, ${store?.city ?? 'India'}`;
            const g = await fetch(`/api/geocode?q=${encodeURIComponent(scoped)}`);
            const gd = await g.json();
            if (gd.result) {
              deliveryLat = gd.result.lat;
              deliveryLng = gd.result.lng;
            }
          } catch {
            /* geocoding is a nicety; the order is not blocked on it */
          }
        }
        if (deliveryLat === undefined && store) {
          // A plausible nearby drop so tracking still has a real route.
          deliveryLat = store.lat + 0.03;
          deliveryLng = store.lng + 0.025;
        }

        setStage('writing');
        // Built once: the same object decides the idempotency key and is the
        // body, so the key can never drift from what it is protecting. The
        // geocoded coordinates are part of it, which is why the key is minted
        // here and not back at the `claiming` beat.
        const payload = {
          lines,
          fulfillment,
          paymentMethod: method,
          storeId,
          guestName: name,
          guestEmail: email,
          guestPhone: phone,
          addressLine: fulfillment === 'delivery' ? address : null,
          deliveryLat,
          deliveryLng,
          tip,
          promoCode,
        };
        const key = idempotencyKey(JSON.stringify(payload));

        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
          body: JSON.stringify({ ...payload, clientClaimedTotal: totals.total }),
        });
        const data = await res.json();

        if (!res.ok) {
          setStage('failed');
          setError(data.error ?? 'That did not go through.');
          toast(data.error ?? 'Order failed.', 'error');
          await beat(2400);
          setStage(null);
          return;
        }

        setStage('done');
        setPlaced(data.order.orderNumber);
        sessionStorage.removeItem('aura.idem');
        sessionStorage.setItem('aura.lastOrder', data.order.orderNumber);
        clear();
        // Hold the closed Halo for a beat so it reads as completion, then hand
        // straight into the confirmation ceremony.
        await beat(760);
        router.push(`/checkout/confirmation?order=${data.order.orderNumber}`);
      } catch {
        setStage('failed');
        setError('The connection dropped. Nothing was charged — try again.');
        await beat(2400);
        setStage(null);
      } finally {
        setBusy(false);
      }
    },
    [address, clear, email, fulfillment, lines, method, name, phone, promoCode, router, store, storeId, tip, totals.total],
  );

  if (hydrated && lines.length === 0) {
    return (
      <EmptyState
        title="There is nothing to check out."
        body="Pick something first. It takes about forty seconds."
        action={{ href: '/menu', label: 'Open the menu' }}
      />
    );
  }

  return (
    <>
      {stage ? <PlacingOverlay stage={stage} error={error} orderNumber={placed} /> : null}
      <form className="checkout" onSubmit={place}>
      <div className="checkout__sections">
        {/* 1 — Fulfillment */}
        <Reveal variant="fade">
          <section className="card stack">
            <h2 style={{ fontSize: 'var(--text-lg)' }}>1 · Where it goes</h2>
            <div className="row" style={{ gap: 'var(--space-2)' }}>
              <button
                type="button"
                className="chip"
                data-active={fulfillment === 'delivery' || undefined}
                onClick={() => setFulfillment('delivery')}
              >
                Delivery
              </button>
              <button
                type="button"
                className="chip"
                data-active={fulfillment === 'pickup' || undefined}
                onClick={() => setFulfillment('pickup')}
              >
                Pickup
              </button>
            </div>

            <SelectField
              label="Bar"
              value={storeId}
              onChange={(e) => handleStoreChange(e.target.value)}
              hint={store?.blurb}
            >
              {cityGroups.map((g) => (
                <optgroup key={g.slug} label={g.name}>
                  {g.stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.id === storeId && nearestLabel ? ' ★' : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </SelectField>

            <div className="field-row">
              <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
              <Field
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                hint="The tracking link goes here"
              />
            </div>
            {nearestLabel && (
              <div className="stack-sm" style={{ marginTop: 'var(--space-2)' }}>
                <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                  <span style={{ color: 'var(--aura-500)' }}>●</span> {nearestLabel}
                  <button type="button" className="muted" style={{ marginLeft: 8, textDecoration: 'underline', fontSize: 11, background: 'none', border: 0, cursor: 'pointer', padding: 0, color: 'inherit' }} onClick={() => { setNearestLabel(null); localStorage.removeItem('aura.store'); }}>change</button>
                </p>
              </div>
            )}
            {detecting && !nearestLabel && (
              <p className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)' }}>
                Finding the nearest outlet…
              </p>
            )}
            <Field label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />

            {fulfillment === 'delivery' ? (
              <TextareaField
                label="Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                hint="We geocode this once, then route it on real roads"
              />
            ) : (
              <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                Collect from {store?.name} — {store?.address}
              </p>
            )}
          </section>
        </Reveal>

        {/* 2 — Payment */}
        <Reveal variant="fade" delay={0.05}>
          <section className="card stack">
            <h2 style={{ fontSize: 'var(--text-lg)' }}>2 · How you pay</h2>
            {payment.methods.map((m) => (
              <label key={m.id} className="pay-option" data-selected={method === m.id || undefined}>
                <input
                  type="radio"
                  name="method"
                  value={m.id}
                  checked={method === m.id}
                  onChange={() => setMethod(m.id)}
                />
                <span className="stack-sm">
                  <strong>{m.label}</strong>
                  <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                    {m.detail}
                  </span>
                </span>
              </label>
            ))}
            <p className="muted" style={{ fontSize: 11 }}>
              {payment.note}
            </p>
          </section>
        </Reveal>

        {/* 3 — Review */}
        <Reveal variant="fade" delay={0.1}>
          <section className="card stack">
            <h2 style={{ fontSize: 'var(--text-lg)' }}>3 · Check it over</h2>
            {lines.map((l) => {
              const pl = totals.lines.find((p) => p.lineId === l.lineId);
              return (
                <div key={l.lineId} className="cart-line">
                  <div className="cart-line__media">
                    <Image src={l.imageUrl} alt="" width={120} height={120} />
                  </div>
                  <div className="cart-line__body">
                    <div className="row-between">
                      <strong>
                        {l.quantity} × {l.name}
                      </strong>
                      <span className="mono">{formatMoney(pl?.lineTotal ?? 0)}</span>
                    </div>
                    <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                      {describeSelection(l.modifiers) || 'As it comes'}
                    </p>
                  </div>
                </div>
              );
            })}
          </section>
        </Reveal>
      </div>

      <aside className="card checkout__summary stack">
        <p className="eyebrow" style={{ marginBottom: 0 }}>
          Total
        </p>

        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <input
            className="input"
            placeholder="Promo code"
            value={promoInput}
            onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
            aria-label="Promo code"
            style={{ minHeight: 40 }}
          />
          <Button type="button" size="sm" onClick={() => setPromoCode(promoInput || null)}>
            Apply
          </Button>
        </div>

        <div className="stack-sm">
          <div className="row-between">
            <span className="muted">Subtotal</span>
            <span className="mono">{formatMoney(totals.subtotal)}</span>
          </div>
          <div className="row-between">
            <span className="muted">GST 5%</span>
            <span className="mono">{formatMoney(totals.tax)}</span>
          </div>
          <div className="row-between">
            <span className="muted">{fulfillment === 'pickup' ? 'Pickup' : 'Delivery'}</span>
            <span className="mono">{formatMoney(totals.deliveryFee)}</span>
          </div>
          {totals.discount > 0 ? (
            <div className="row-between" style={{ color: 'var(--verdant-500)' }}>
              <span>Discount</span>
              <span className="mono">−{formatMoney(totals.discount)}</span>
            </div>
          ) : null}
          <div className="row-between">
            <span className="muted">Tip the bar</span>
            <span className="row" style={{ gap: 4 }}>
              {[0, 2000, 5000, 10000].map((t) => (
                <button
                  key={t}
                  type="button"
                  className="chip"
                  data-active={tip === t || undefined}
                  onClick={() => setTip(t)}
                  style={{ minHeight: 28, padding: '2px 10px' }}
                >
                  {t === 0 ? 'None' : formatMoney(t)}
                </button>
              ))}
            </span>
          </div>
        </div>

        <hr className="rule" />

        <div className="row-between">
          <strong>To pay</strong>
          {/* The one piece of motion on this page. */}
          <strong className="mono" style={{ color: 'var(--aura-500)', fontSize: 'var(--text-lg)' }}>
            <NumberRoll value={totals.total} format={(n) => formatMoney(Math.round(n))} />
          </strong>
        </div>

        {error ? (
          <p className="field__error">
            <span aria-hidden="true">⚠</span>
            {error}
          </p>
        ) : null}

        <Button type="submit" variant="primary" size="lg" block loading={busy}>
          {method === 'cash' ? 'Place order · pay cash' : 'Place order · pay by UPI'}
        </Button>

        <p className="muted" style={{ fontSize: 11 }}>
          {server
            ? 'This total was recomputed on the server from stored prices. It is the number that gets written.'
            : 'Checking prices with the bar…'}
        </p>
        </aside>
      </form>
    </>
  );
}
