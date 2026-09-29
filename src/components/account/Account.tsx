'use client';
/**
 * /account (Blueprint §13.4, §14.6).
 *
 * Tab ↔ tab is NOT navigation: content cross-fades in place and the active-tab
 * underline slides between labels under --ease-aura, 240ms. No page transition,
 * no reload, no route change.
 *
 * The loyalty Halo animates from 0 to current on FIRST VIEW ONLY.
 */
import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formatMoney } from '@/domain/money';
import { TIERS, type LoyaltyView } from '@/domain/loyalty';
import { ORDER_STAGE_COPY } from '@/domain/state-machine';
import { signOutAction } from '@/app/login/actions';
import { Halo } from '@/components/motion/Halo';
import { Reveal } from '@/components/motion/Reveal';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/bits';
import { toast } from '@/components/toast/ToastProvider';
import type { OrderStatus, Subscription, User } from '@/domain/types';

/** What the orders tab draws — the live stage, derived on the server. */
export interface AccountOrder {
  id: string;
  orderNumber: string;
  total: number;
  placedAt: string;
  stage: OrderStatus;
  items: { id: string; quantity: number; name: string }[];
}

const TABS = [
  { id: 'orders', label: 'Orders' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'loyalty', label: 'Loyalty' },
  { id: 'details', label: 'Saved details' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function Account({
  user,
  loyalty,
  orders,
  subscriptions: initialSubs,
  drinkNames,
  initialTab,
  signedIn,
  isAdmin,
}: {
  user: User;
  loyalty: LoyaltyView;
  orders: AccountOrder[];
  subscriptions: Subscription[];
  drinkNames: Record<string, string>;
  initialTab?: string;
  /** False for the zero-config demo profile, which has nothing to sign out of. */
  signedIn: boolean;
  isAdmin: boolean;
}) {
  const [tab, setTab] = useState<TabId>(
    (TABS.find((t) => t.id === initialTab)?.id ?? 'orders') as TabId,
  );
  const [subs, setSubs] = useState(initialSubs);
  const [haloProgress, setHaloProgress] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [underline, setUnderline] = useState({ left: 0, width: 0 });

  // First view only.
  useEffect(() => {
    if (tab !== 'loyalty') return;
    const t = setTimeout(() => setHaloProgress(loyalty.overallProgress), 120);
    return () => clearTimeout(t);
  }, [tab, loyalty.overallProgress]);

  useLayoutEffect(() => {
    const el = tabsRef.current?.querySelector<HTMLElement>(`[data-tab="${tab}"]`);
    if (!el) return;
    setUnderline({ left: el.offsetLeft, width: el.offsetWidth });
  }, [tab]);

  // role="tab" promises arrow-key movement, so honour it (roving tabindex below).
  const onTabKeys = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const i = TABS.findIndex((t) => t.id === tab);
      const to =
        e.key === 'ArrowRight' ? (i + 1) % TABS.length
        : e.key === 'ArrowLeft' ? (i - 1 + TABS.length) % TABS.length
        : e.key === 'Home' ? 0
        : e.key === 'End' ? TABS.length - 1
        : -1;
      if (to < 0) return;
      e.preventDefault();
      setTab(TABS[to].id);
      tabsRef.current?.querySelector<HTMLElement>(`[data-tab="${TABS[to].id}"]`)?.focus();
    },
    [tab],
  );

  const [pendingSub, setPendingSub] = useState<string | null>(null);

  const patchSub = useCallback(async (body: { id: string } & Record<string, unknown>) => {
    setPendingSub(body.id);
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error ?? 'That did not work.', 'error');
        return;
      }
      setSubs((prev) => prev.map((s) => (s.id === data.subscription.id ? data.subscription : s)));
      toast('Updated.', 'success');
    } catch {
      toast('The connection dropped — nothing changed.', 'error');
    } finally {
      setPendingSub(null);
    }
  }, []);

  return (
    <div className="shell account">
      <header className="page-head account__head">
        <div className="row" style={{ gap: 'var(--space-4)', alignItems: 'center' }}>
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt=""
              width={56}
              height={56}
              referrerPolicy="no-referrer"
              className="account-avatar"
              style={{ width: 56, height: 56 }}
            />
          ) : null}
          <div className="stack-sm" style={{ gap: 2 }}>
            <p className="eyebrow">{signedIn ? 'Signed in as' : 'Demo profile'}</p>
            <h1>{user.name}</h1>
            <p className="muted">{user.email}</p>
          </div>
        </div>
        <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
          {isAdmin ? (
            <Link href="/admin" className="btn btn--outline btn--sm">
              Back office
            </Link>
          ) : null}
          {signedIn ? (
            <form action={signOutAction}>
              <button type="submit" className="btn btn--ghost btn--sm">
                Sign out
              </button>
            </form>
          ) : null}
        </div>
      </header>

      <div className="tabs" role="tablist" ref={tabsRef} onKeyDown={onTabKeys}>
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            data-tab={t.id}
            className="tab"
            aria-selected={tab === t.id}
            aria-controls="account-panel"
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <span
          className="tabs__underline"
          style={{ transform: `translateX(${underline.left}px)`, width: underline.width }}
          aria-hidden="true"
        />
      </div>

      {/* One panel that cross-fades, so one stable id every tab points at. */}
      <div
        key={tab}
        id="account-panel"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
        className="account__panel"
        style={{ paddingTop: 'var(--space-6)' }}
      >
        {tab === 'orders' ? (
          orders.length === 0 ? (
            <EmptyState
              title="No orders yet."
              body="Your first one takes about forty seconds to build."
              action={{ href: '/menu', label: 'Open the menu' }}
            />
          ) : (
            <Reveal variant="stagger" stagger={0.05} className="stack">
              {orders.map((o) => (
                <Link key={o.id} href={`/track/${o.orderNumber}`} className="store-row">
                  <div className="row-between">
                    <strong className="mono">{o.orderNumber}</strong>
                    <span className="mono">{formatMoney(o.total)}</span>
                  </div>
                  <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                    {o.items.map((i) => `${i.quantity} × ${i.name}`).join(', ')}
                  </p>
                  <p className="mono muted" style={{ fontSize: 11 }}>
                    {ORDER_STAGE_COPY[o.stage]?.label} ·{' '}
                    {/* Pinned to IST so the SSR'd day survives hydration. */}
                    {new Date(o.placedAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </p>
                </Link>
              ))}
            </Reveal>
          )
        ) : null}

        {tab === 'subscriptions' ? (
          subs.length === 0 ? (
            <EmptyState
              title="No standing order."
              body="Weekly, biweekly or monthly. Pause it any time, skip a delivery without cancelling."
              action={{ href: '/menu?category=beans', label: 'Pick a bean' }}
            />
          ) : (
            <Reveal variant="stagger" stagger={0.05} className="stack">
              {subs.map((s) => (
                <article key={s.id} className="card" aria-busy={pendingSub === s.id || undefined}>
                  <div className="row-between">
                    <strong>
                      {s.drinkId ? (drinkNames[s.drinkId] ?? 'Whole bean') : 'Surprise me'} · 250g
                    </strong>
                    <span className="badge badge--aura">{s.status}</span>
                  </div>
                  <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                    {s.cadence} · {s.quantity} bag{s.quantity > 1 ? 's' : ''} · next{' '}
                    {/* nextDelivery is a bare date key — a calendar day, not an instant.
                        Parse and format it in one zone or a visitor west of the host
                        reads the delivery a day early. */}
                    {new Date(`${s.nextDelivery}T00:00:00Z`).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      timeZone: 'UTC',
                    })}
                  </p>
                  {s.status !== 'cancelled' ? (
                    <div className="row wrap" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                      <Button
                        size="sm"
                        disabled={pendingSub === s.id || s.status !== 'active'}
                        onClick={() => patchSub({ id: s.id, skip: true })}
                      >
                        Skip next
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pendingSub === s.id}
                        onClick={() =>
                          patchSub({ id: s.id, status: s.status === 'active' ? 'paused' : 'active' })
                        }
                      >
                        {s.status === 'active' ? 'Pause' : 'Resume'}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={pendingSub === s.id}
                        onClick={() => {
                          if (window.confirm('Cancel this subscription? This cannot be undone.')) {
                            void patchSub({ id: s.id, status: 'cancelled' });
                          }
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : null}
                </article>
              ))}
            </Reveal>
          )
        ) : null}

        {tab === 'loyalty' ? (
          <div className="stack">
            <div className="row" style={{ gap: 'var(--space-7)', flexWrap: 'wrap' }}>
              {/* The four tiers ARE the four quadrants of the Halo (§1.3 #2). */}
              <Halo
                size={200}
                stroke={3}
                progress={haloProgress}
                quadrants
                activeQuadrant={loyalty.tier.quadrant}
                label={`${loyalty.tier.tier} tier`}
              >
                <div className="stack-sm" style={{ gap: 2, textAlign: 'center' }}>
                  <span
                    className="mono"
                    style={{ fontSize: 'var(--text-xs)', color: 'var(--smoke-400)', letterSpacing: '0.18em' }}
                  >
                    TIER
                  </span>
                  <strong style={{ fontFamily: 'var(--font-display), serif', fontSize: 'var(--text-lg)' }}>
                    {loyalty.tier.tier}
                  </strong>
                </div>
              </Halo>

              <div className="stack-sm" style={{ flex: 1, minWidth: 240 }}>
                <p className="eyebrow">{loyalty.lifetimePoints} lifetime points</p>
                <p className="lede">{loyalty.tier.blurb}</p>
                {loyalty.next ? (
                  <p className="muted">
                    {loyalty.pointsToNext} points to <strong>{loyalty.next.tier}</strong>.
                  </p>
                ) : (
                  <p className="muted">Top tier. The Halo is closed.</p>
                )}
                <p className="mono muted" style={{ fontSize: 10, marginTop: 'var(--space-3)' }}>
                  Tier is derived on read from lifetime_points. It is stored in no table — if the
                  two ever disagreed there would be nothing to disagree with.
                </p>
              </div>
            </div>

            <Reveal variant="flip" stagger={0.07} className="tier-grid">
              {TIERS.map((t) => (
                <div
                  key={t.tier}
                  className="tier-card"
                  data-reached={loyalty.lifetimePoints >= t.pointsThreshold || undefined}
                  data-current={t.tier === loyalty.tier.tier || undefined}
                >
                  <div className="row-between">
                    <strong>{t.tier}</strong>
                    <span className="mono muted" style={{ fontSize: 11 }}>
                      {t.pointsThreshold}
                    </span>
                  </div>
                  <ul className="stack-sm" style={{ marginTop: 'var(--space-3)' }}>
                    {t.perks.map((p) => (
                      <li key={p} className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                        · {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </Reveal>
          </div>
        ) : null}

        {tab === 'details' ? (
          <div className="stack">
            <div className="card stack-sm">
              <p className="field__label">Referral code</p>
              <div className="row-between">
                <span className="mono" style={{ fontSize: 'var(--text-lg)', color: 'var(--aura-500)' }}>
                  {user.referralCode}
                </span>
                <Button
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard?.writeText(user.referralCode);
                    toast('Code copied', 'success');
                  }}
                >
                  Copy
                </Button>
              </div>
              <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                Both sides earn 140 points on their first order.
              </p>
            </div>
            <div className="card stack-sm">
              <p className="field__label">Locale &amp; currency</p>
              <p className="mono">
                {user.locale} · {user.currency}
              </p>
              <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                Scaffolded from day one rather than retrofitted. Money is stored as integer paise
                everywhere, so a second currency is a formatting change, not a migration.
              </p>
            </div>
          </div>
        ) : null}
      </div>
      <div style={{ height: 'var(--space-10)' }} />
    </div>
  );
}
