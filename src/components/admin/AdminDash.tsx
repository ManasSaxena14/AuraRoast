'use client';
/**
 * /admin (Blueprint §2.2, §8.4, §14.6).
 *
 * Upgraded admin dashboard with search, filters, enhanced visuals, and
 * professional polish while preserving all existing functionality.
 */
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { formatMoney } from '@/domain/money';
import { toDateKey } from '@/domain/slots';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/bits';
import { toast } from '@/components/toast/ToastProvider';
import Link from 'next/link';
import type { Drink, Order, Reservation, OrderStatus, PaymentStatus } from '@/domain/types';

type Tab = 'payments' | 'orders' | 'reservations' | 'catalogue';
type StatusFilter = 'all' | 'pending_payment' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';

/** Pinned to the shop's zone, so the server render and hydration agree. */
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/** The stage the order is actually at — derived on the server for this page. */
const stageOf = (o: Order): OrderStatus => o.derivedStage ?? o.status;

export function AdminDash({
  initialOrders,
  reservations,
  drinks,
  backend,
  demo,
}: {
  initialOrders: Order[];
  reservations: Reservation[];
  drinks: Drink[];
  backend: string;
  demo: boolean;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [tab, setTab] = useState<Tab>('payments');
  const [orders, setOrders] = useState(initialOrders);
  // A refresh re-renders the server page with fresh rows; take them.
  useEffect(() => setOrders(initialOrders), [initialOrders]);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [revenueFilter, setRevenueFilter] = useState<'all' | 'today'>('all');
  const [sort, setSort] = useState<{ key: 'placedAt' | 'total'; dir: 1 | -1 }>({
    key: 'placedAt',
    dir: -1,
  });

  const pending = useMemo(
    () =>
      orders.filter(
        (o) => o.paymentMethod === 'upi' && o.paymentStatus === 'pending' && o.status === 'pending_payment',
      ),
    [orders],
  );
  const today = toDateKey();

  const filtered = useMemo(() => {
    let result = [...orders];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.guestEmail?.toLowerCase().includes(q) ||
        o.guestName?.toLowerCase().includes(q) ||
        o.guestPhone?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter((o) => stageOf(o) === statusFilter);
    }
    if (revenueFilter === 'today') {
      // "Today" in the shop's zone: a UTC date calls a 2am order yesterday's.
      result = result.filter((o) => toDateKey(new Date(o.placedAt)) === today);
    }
    return result;
  }, [orders, search, statusFilter, revenueFilter, today]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const va = sort.key === 'total' ? a.total : new Date(a.placedAt).getTime();
        const vb = sort.key === 'total' ? b.total : new Date(b.placedAt).getTime();
        return (va - vb) * sort.dir;
      }),
    [filtered, sort],
  );

  const totalRevenue = useMemo(
    () => orders.filter((o) => o.status !== 'cancelled').reduce((a, o) => a + o.total, 0),
    [orders],
  );

  const todayRevenue = useMemo(
    () =>
      orders
        .filter((o) => o.status !== 'cancelled' && toDateKey(new Date(o.placedAt)) === today)
        .reduce((a, o) => a + o.total, 0),
    [orders, today],
  );

  const avgOrderValue = useMemo(() => {
    const completed = orders.filter((o) => o.status !== 'cancelled');
    if (completed.length === 0) return 0;
    return Math.round(completed.reduce((a, o) => a + o.total, 0) / completed.length);
  }, [orders]);

  const popularDrink = useMemo(() => {
    // Counted by the receipt name, which every line has — pairings carry no
    // drink id, and an id is not something to show a person anyway.
    const counts = new Map<string, number>();
    for (const o of orders) {
      if (o.status === 'cancelled') continue;
      for (const item of o.items) {
        counts.set(item.nameSnapshot, (counts.get(item.nameSnapshot) ?? 0) + item.quantity);
      }
    }
    let best: { name: string; count: number } | null = null;
    for (const [name, count] of counts) {
      if (!best || count > best.count) best = { name, count };
    }
    return best;
  }, [orders]);

  // Authorised by the signed-in staff session — no secret ever reaches the browser.
  const verify = useCallback(async (orderNumber: string) => {
    setVerifying(orderNumber);
    try {
      const res = await fetch(`/api/admin/orders/${orderNumber}/verify-payment`, { method: 'PATCH' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(
          res.status === 403 ? 'Your session is not staff any more — sign in again.' : (data.error ?? 'Could not verify.'),
          'error',
        );
        return;
      }
      const updated = data.order as Order;
      setOrders((prev) =>
        prev.map((o) =>
          o.orderNumber === orderNumber
            ? { ...updated, derivedStage: 'confirmed', routeGeometry: null }
            : o,
        ),
      );
      toast(`${orderNumber} confirmed — the delivery plan and route were written.`, 'success');
    } catch {
      toast('The connection dropped — nothing was verified.', 'error');
    } finally {
      setVerifying(null);
    }
  }, []);

  const statusBadge = (status: OrderStatus | null | undefined, paymentStatus: PaymentStatus) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      confirmed: { bg: 'rgb(108 143 106 / 0.15)', color: 'var(--verdant-500)', label: 'confirmed' },
      preparing: { bg: 'rgb(216 166 87 / 0.15)', color: 'var(--aura-500)', label: 'preparing' },
      out_for_delivery: { bg: 'rgb(216 166 87 / 0.15)', color: 'var(--aura-300)', label: 'out for delivery' },
      delivered: { bg: 'rgb(108 143 106 / 0.15)', color: 'var(--verdant-500)', label: 'delivered' },
      cancelled: { bg: 'rgb(123 59 44 / 0.15)', color: '#e8a598', label: 'cancelled' },
      pending_payment: { bg: 'rgb(216 166 87 / 0.15)', color: 'var(--aura-300)', label: 'pending payment' },
    };
    const rawKey = status === 'pending_payment' && paymentStatus === 'pending' ? 'pending_payment' : status;
    const key: string = rawKey ?? 'confirmed';
    const s = map[key] ?? map.confirmed;
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 'var(--radius-full)',
        background: s.bg,
        color: s.color,
        fontSize: 10,
        fontFamily: 'var(--font-mono), monospace',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}>
        {s.label}
      </span>
    );
  };

  return (
    <div className="shell admin">
      <header className="row-between" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <p className="eyebrow">Back of house</p>
          <h1 style={{ fontSize: 'var(--text-xl)' }}>Admin</h1>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          {demo ? <span className="badge badge--seasonal">demo mode</span> : null}
          <span className="badge badge--muted">{backend}</span>
          <Button size="sm" variant="ghost" loading={refreshing} onClick={() => startRefresh(() => router.refresh())}>
            Refresh
          </Button>
          <Link href="/" className="btn btn--ghost btn--sm">
            ← Back to site
          </Link>
        </div>
      </header>

      <div className="stat-grid">
        <div className="stat">
          <p className="stat__value">{orders.length}</p>
          <p className="stat__label">Total orders</p>
        </div>
        <div className="stat">
          <p className="stat__value">{formatMoney(revenueFilter === 'today' ? todayRevenue : totalRevenue)}</p>
          <p className="stat__label">{revenueFilter === 'today' ? "Today's revenue" : 'Gross revenue'}</p>
        </div>
        <div className="stat">
          <p className="stat__value">{formatMoney(avgOrderValue)}</p>
          <p className="stat__label">Avg order value</p>
        </div>
        <div className="stat">
          <p className="stat__value">{pending.length}</p>
          <p className="stat__label">UPI awaiting verify</p>
        </div>
        <div className="stat">
          <p className="stat__value">{reservations.filter((r) => r.status === 'booked').length}</p>
          <p className="stat__label">Live reservations</p>
        </div>
        {popularDrink && (
          <div className="stat">
            <p className="stat__value" style={{ fontSize: 'var(--text-base)' }}>{popularDrink.name}</p>
            <p className="stat__label">Top item ({popularDrink.count} sold)</p>
          </div>
        )}
      </div>

      <div className="admin-toolbar">
        <div className="admin-tabs">
          {(['payments', 'orders', 'reservations', 'catalogue'] as Tab[]).map((t) => (
            <button key={t} className="chip" data-active={tab === t || undefined} onClick={() => setTab(t)}>
              {t === 'payments' && pending.length > 0 ? `${t} (${pending.length})` : t}
            </button>
          ))}
        </div>
        <div className="admin-filters">
          <input
            className="input admin-search"
            placeholder="Search order #, email, name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search orders"
          />
          <select
            className="select admin-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="pending_payment">Pending payment</option>
            <option value="confirmed">Confirmed</option>
            <option value="preparing">Preparing</option>
            <option value="out_for_delivery">Out for delivery</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button
            className="chip"
            data-active={revenueFilter === 'today' || undefined}
            onClick={() => setRevenueFilter((f) => f === 'today' ? 'all' : 'today')}
          >
            {revenueFilter === 'today' ? 'Today ✓' : 'All time'}
          </button>
        </div>
      </div>

      {tab === 'payments' ? (
        pending.length === 0 ? (
          <EmptyState title="Nothing waiting." body="Every UPI transfer has been matched and confirmed." />
        ) : (
          <div className="stack">
            <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Placed</th>
                  <th>Guest</th>
                  <th>UTR</th>
                  <th>Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pending.map((o) => (
                  <tr key={o.id}>
                    <td className="mono">{o.orderNumber}</td>
                    <td className="mono">{when(o.placedAt)}</td>
                    <td>{o.guestEmail}</td>
                    <td className="mono">{o.upiTransactionRef ?? '—'}</td>
                    <td className="mono">{formatMoney(o.total)}</td>
                    <td>
                      <Button
                        size="sm"
                        variant="primary"
                        loading={verifying === o.orderNumber}
                        onClick={() => verify(o.orderNumber)}
                      >
                        Verify transfer
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted" style={{ fontSize: 11, marginTop: 'var(--space-4)' }}>
              This is the only path in the entire system that can confirm a UPI order. It sets
              payment_status, status and confirmed_at, writes the delivery plan, calls OSRM once,
              and accrues loyalty — in one transaction.
            </p>
            </div>
          </div>
        )
      ) : null}

      {tab === 'orders' ? (
        filtered.length === 0 ? (
          <EmptyState title="No orders match." body={search ? 'Try a different search term or filter.' : 'Place one from the guest side and it appears here.'} />
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>
                    <button
                      className="tab"
                      style={{ padding: 0 }}
                      onClick={() =>
                        setSort((s) => ({ key: 'placedAt', dir: s.key === 'placedAt' && s.dir === -1 ? 1 : -1 }))
                      }
                    >
                      Order {sort.key === 'placedAt' ? (sort.dir === -1 ? '↓' : '↑') : ''}
                    </button>
                  </th>
                  <th>
                    <button
                      className="tab"
                      style={{ padding: 0 }}
                      onClick={() =>
                        setSort((s) => ({ key: 'placedAt', dir: s.key === 'placedAt' && s.dir === -1 ? 1 : -1 }))
                      }
                    >
                      Placed {sort.key === 'placedAt' ? (sort.dir === -1 ? '↓' : '↑') : ''}
                    </button>
                  </th>
                  <th>Guest</th>
                  <th>Stage</th>
                  <th>Pay</th>
                  <th>
                    <button
                      className="tab"
                      style={{ padding: 0 }}
                      onClick={() =>
                        setSort((s) => ({ key: 'total', dir: s.key === 'total' && s.dir === -1 ? 1 : -1 }))
                      }
                    >
                      Total {sort.key === 'total' ? (sort.dir === -1 ? '↓' : '↑') : ''}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((o) => (
                  <tr key={o.id}>
                    <td className="mono" style={{ fontSize: 11 }}>{o.orderNumber}</td>
                    <td className="mono" style={{ whiteSpace: 'nowrap' }}>{when(o.placedAt)}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span>{o.guestName ?? '—'}</span>
                        <span className="muted" style={{ fontSize: 11 }}>{o.guestEmail ?? '—'}</span>
                      </div>
                    </td>
                    <td>{statusBadge(stageOf(o), o.paymentStatus)}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 11, textTransform: 'capitalize' }}>{o.paymentMethod}</span>
                        <span className="muted" style={{ fontSize: 10, textTransform: 'capitalize' }}>{o.paymentStatus}</span>
                      </div>
                    </td>
                    <td className="mono" style={{ whiteSpace: 'nowrap' }}>{formatMoney(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted" style={{ fontSize: 11, marginTop: 'var(--space-4)' }}>
              Showing {sorted.length} of {orders.length} orders
            </p>
          </div>
        )
      ) : null}

      {tab === 'reservations' ? (
        reservations.length === 0 ? (
          <EmptyState title="No bookings." body="Tables open fourteen days ahead, in thirty-minute slots." />
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>When</th>
                  <th>Room</th>
                  <th>Guest</th>
                  <th>Party</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.reference}</td>
                    <td className="mono">
                      {r.slot?.slotDate} {r.slot?.slotTime}
                    </td>
                    <td>
                      {r.store?.name}
                      {r.slot?.eventTitle ? (
                        <span className="muted" style={{ display: 'block', fontSize: 11 }}>{r.slot.eventTitle}</span>
                      ) : null}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span>{r.guestName}</span>
                        <span className="muted" style={{ fontSize: 11 }}>
                          {r.guestEmail}
                          {r.guestPhone ? ` · ${r.guestPhone}` : ''}
                        </span>
                      </div>
                    </td>
                    <td className="mono">{r.partySize}</td>
                    <td>{r.status === 'booked' ? '✓ booked' : r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === 'catalogue' ? (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Drink</th>
                <th>Category</th>
                <th>Roast</th>
                <th>Caffeine</th>
                <th>Base price</th>
                <th>Available</th>
              </tr>
            </thead>
            <tbody>
              {drinks.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <img src={d.imageUrl} alt="" width={40} height={40} style={{ borderRadius: 'var(--radius-sm)', objectFit: 'cover' }} />
                      <span>{d.name}</span>
                    </div>
                  </td>
                  <td style={{ textTransform: 'capitalize' }}>{d.category}</td>
                  <td>{d.roast ?? '—'}</td>
                  <td className="mono">{d.caffeineMg}mg</td>
                  <td className="mono">{formatMoney(d.basePrice)}</td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: d.isAvailable ? 'var(--verdant-500)' : 'var(--terra-600)',
                    }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div style={{ height: 'var(--space-9)' }} />
    </div>
  );
}
