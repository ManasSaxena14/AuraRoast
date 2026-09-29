import Link from 'next/link';
import type { Metadata } from 'next';
import { features } from '@/config/env';
import { getViewer } from '@/lib/session';
import { deriveTrackingState } from '@/domain/tracking';
import { withDerivedPlan } from '@/services/order';
import {
  backendName,
  listDrinks,
  listOrders,
  listPendingUpiOrders,
  listReservations,
} from '@/repositories';
import { AdminDash } from '@/components/admin/AdminDash';
import { Halo } from '@/components/motion/Halo';
import type { Order } from '@/domain/types';

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * The back office. Every guest's name, email, phone and address is on this
 * page, so the check happens HERE, on the server, before a single row is
 * read — a client-side gate would still have shipped the data.
 */
export default async function AdminPage() {
  const viewer = await getViewer();

  if (!viewer?.isAdmin) {
    return (
      <div className="login">
        <div style={{ justifySelf: 'center' }}>
          <Halo size={110} stroke={2} progress={0.25} />
        </div>
        <h1 style={{ fontSize: 'var(--text-2xl)' }}>Staff only.</h1>
        <p className="lede" style={{ marginInline: 'auto', maxWidth: '44ch' }}>
          {viewer
            ? `${viewer.user.email} is not on the staff list. Ask the owner to add it to ADMIN_EMAILS.`
            : features.googleAuth
              ? 'Sign in with a staff Google account to open the back office.'
              : 'The back office needs Google sign-in, which is not configured on this deployment.'}
        </p>
        <div className="row" style={{ justifyContent: 'center', gap: 'var(--space-3)' }}>
          {!viewer && features.googleAuth ? (
            <Link href="/login?callbackUrl=/admin" className="btn btn--primary">
              Sign in
            </Link>
          ) : null}
          <Link href="/" className="btn btn--outline">
            Back to the site
          </Link>
        </div>
      </div>
    );
  }

  const [recent, pending, reservations, drinks] = await Promise.all([
    listOrders({ limit: 200 }),
    listPendingUpiOrders(),
    listReservations(),
    listDrinks(),
  ]);

  // Every pending transfer, however old, plus the recent history — once each.
  const seen = new Set(pending.map((o) => o.orderNumber));
  const now = Date.now();
  const orders: Order[] = await Promise.all(
    [...pending, ...recent.filter((o) => !seen.has(o.orderNumber))].map(async (o) => ({
      ...o,
      // The live stage, not the lazily written column; and no road geometry —
      // a table does not need thousands of coordinates per row.
      derivedStage:
        o.status === 'cancelled'
          ? ('cancelled' as const)
          : deriveTrackingState(await withDerivedPlan(o), now).currentStage,
      routeGeometry: null,
    })),
  );

  return (
    <AdminDash
      initialOrders={orders}
      reservations={reservations}
      drinks={drinks}
      backend={backendName()}
      demo={viewer.demo}
    />
  );
}
