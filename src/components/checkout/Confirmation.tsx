'use client';
/**
 * /checkout/confirmation — the ceremony (Blueprint §13.4).
 *
 * The page dims to --roast-950; the Halo draws 0° → 360° over 900ms; a check
 * strokes in under --ease-bloom; the receipt rises beneath it, staggered.
 * 1200ms total — the ONLY transition in the build allowed over 800ms.
 *
 * The Halo carries `view-transition-name: order-halo`, so when the guest taps
 * through to tracking it does not disappear and reappear: it shrinks, moves to
 * the tracking header, and becomes the live progress ring (§13.4).
 */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '@/domain/money';
import { Halo } from '@/components/motion/Halo';
import { Reveal } from '@/components/motion/Reveal';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { toast } from '@/components/toast/ToastProvider';
import type { Order } from '@/domain/types';

const REDIRECT_SECONDS = 5;

export function Confirmation({
  order,
  upi,
  qrSvg,
}: {
  order: Order;
  upi: { uri: string; upiId: string; payeeName: string } | null;
  qrSvg: string | null;
}) {
  const [drawn, setDrawn] = useState(0);
  const [utr, setUtr] = useState(order.upiTransactionRef ?? '');
  const [saving, setSaving] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(REDIRECT_SECONDS);
  const [redirecting, setRedirecting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDrawn(1), 60);
    return () => clearTimeout(t);
  }, []);

  /* Auto-redirect countdown after receipt has been visible for ~5 seconds. */
  useEffect(() => {
    if (redirecting) return;
    const id = setInterval(() => {
      setRedirectCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          setRedirecting(true);
          window.location.href = `/track/${order.orderNumber}`;
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    timerRef.current = id;
    return () => clearInterval(id);
  }, [order.orderNumber, redirecting]);

  const cancelRedirect = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRedirecting(true);
    setRedirectCountdown(0);
  };

  const cash = order.paymentMethod === 'cash';

  return (
    <div className="confirm">
      <div className="confirm__halo">
        <Halo size={168} stroke={2.5} progress={drawn} shared label="Order confirmed" />
        {cash ? (
          <span className="confirm__check" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="48" height="48">
              <path
                d="M14 25l7 7 14-15"
                fill="none"
                stroke="var(--aura-500)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        ) : null}
      </div>

      <Reveal variant="rise" delay={0.55} className="stack">
        <h1>{cash ? 'The bar has your ticket.' : 'One step left.'}</h1>
        <p className="lede" style={{ marginInline: 'auto' }}>
          {cash
            ? 'Cash orders confirm the moment they are placed. There is genuinely nothing to verify until the courier or the counter handles it.'
            : 'Send the transfer and we will confirm it by hand, usually within a few minutes. Nothing is charged automatically.'}
        </p>
        <p className="mono" style={{ fontSize: 'var(--text-2xl)', color: 'var(--aura-500)' }}>
          {order.orderNumber}
        </p>
      </Reveal>

      {!cash && upi ? (
        <Reveal variant="rise" delay={0.7} className="stack" >
          <div className="card stack" style={{ maxWidth: 460, marginInline: 'auto', width: '100%' }}>
            {qrSvg ? (
              <div className="qr-panel" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            ) : null}
            <div className="row-between">
              <span className="muted">UPI ID</span>
              <button
                className="mono link-arrow"
                onClick={() => {
                  void navigator.clipboard?.writeText(upi.upiId);
                  toast('UPI ID copied', 'success');
                }}
              >
                {upi.upiId}
              </button>
            </div>
            <div className="row-between">
              <span className="muted">Amount</span>
              <span className="mono">{formatMoney(order.total)}</span>
            </div>
            {/* Scanning a QR on the phone you are paying FROM is a small but
                real usability failure. The deep link exists for that. */}
            <a href={upi.uri} className="btn btn--primary btn--block">
              Open a UPI app
            </a>
            <form
              className="row"
              style={{ gap: 'var(--space-2)' }}
              onSubmit={async (e) => {
                e.preventDefault();
                setSaving(true);
                try {
                  // This used to GET the order, throw the response away and
                  // claim the reference was noted. It now actually stores it.
                  const res = await fetch(`/api/orders/${order.orderNumber}/utr`, {
                    method: 'PATCH',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(order.guestEmail ? { 'X-Aura-Contact': order.guestEmail } : {}),
                    },
                    body: JSON.stringify({ utr }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    toast(data.error ?? 'Could not save that reference.', 'error');
                    return;
                  }
                  toast('Reference noted — we will match it against the transfer.', 'success');
                } catch {
                  toast('Could not save that reference.', 'error');
                } finally {
                  setSaving(false);
                }
              }}
            >
              <Field
                label="UTR (optional)"
                value={utr}
                onChange={(e) => setUtr(e.target.value)}
                hint="12 digits, from your UPI app"
                className="stack-sm"
              />
              <Button type="submit" size="sm" loading={saving} style={{ alignSelf: 'flex-end' }}>
                Save
              </Button>
            </form>
          </div>
        </Reveal>
      ) : null}

      <Reveal variant="rise" delay={0.85}>
        <div className="card receipt">
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
          <div className="receipt__row">
            <span className="muted">GST 5%</span>
            <span className="mono">{formatMoney(order.tax)}</span>
          </div>
          <div className="receipt__row">
            <span className="muted">{order.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'}</span>
            <span className="mono">{formatMoney(order.deliveryFee)}</span>
          </div>
          {order.tip > 0 ? (
            <div className="receipt__row">
              <span className="muted">Tip</span>
              <span className="mono">{formatMoney(order.tip)}</span>
            </div>
          ) : null}
          {order.discount > 0 ? (
            <div className="receipt__row" style={{ color: 'var(--verdant-500)' }}>
              <span>Discount</span>
              <span className="mono">−{formatMoney(order.discount)}</span>
            </div>
          ) : null}
          <div className="receipt__row receipt__row--total">
            <span>Total</span>
            <span className="mono">{formatMoney(order.total)}</span>
          </div>
        </div>
      </Reveal>

      <Reveal variant="fade" delay={1}>
        <div className="row" style={{ justifyContent: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Link href={`/track/${order.orderNumber}`} className="btn btn--primary btn--lg" prefetch>
            Track live
          </Link>
          <Link href="/menu" className="btn btn--outline btn--lg">
            Order something else
          </Link>
          {!redirecting && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={cancelRedirect} style={{ color: 'var(--smoke-400)', minHeight: 36 }}>
              Stay on this page
            </button>
          )}
        </div>
        {/* Countdown bar — shows redirect progress to tracking */}
        {!redirecting && (() => {
          const pct = `${Math.max(0, (redirectCountdown / REDIRECT_SECONDS) * 100)}%`;
          return (
          <div style={{ maxWidth: 320, marginInline: 'auto', marginTop: 'var(--space-4)', textAlign: 'center' }}>
            <div style={{ height: 2, background: 'rgb(242 206 147 / 0.12)', borderRadius: 1, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: pct, background: 'var(--aura-500)', borderRadius: 1, transition: 'width 1s linear' }} />
            </div>
            <p className="muted" style={{ fontSize: 10, marginTop: 6, letterSpacing: '0.08em' }}>
              Redirecting to tracking in {redirectCountdown}s
            </p>
          </div>
          );
        })()}
      </Reveal>
    </div>
  );
}
