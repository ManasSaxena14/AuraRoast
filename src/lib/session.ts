/**
 * Who is asking — the one place pages and route handlers resolve it.
 *
 * `getViewer()` is null for a guest, or the signed-in account's own row plus
 * whether it may use the back office. It is request-memoised, so a page and
 * the components under it share one lookup.
 */
import { cache } from 'react';
import { auth } from '@/auth';
import { demoMode, features, isAdminEmail } from '@/config/env';
import { DEMO_USER_ID, getUser, upsertOAuthUser } from '@/repositories';
import type { Order, User } from '@/domain/types';

export interface Viewer {
  user: User;
  isAdmin: boolean;
  /** Zero-config local development: the demo profile, no real sign-in. */
  demo: boolean;
}

/** Never throws: a misconfigured or unreachable auth layer reads as "signed out". */
export const getSession = cache(async () => {
  if (!features.googleAuth) return null;
  try {
    return await auth();
  } catch (err) {
    console.error('auth_session_failed', err);
    return null;
  }
});

const DEMO_EMAIL = 'guest@aura-toast.test';

export const getViewer = cache(async (): Promise<Viewer | null> => {
  try {
    if (demoMode) {
      const user =
        (await getUser(DEMO_USER_ID)) ??
        (await upsertOAuthUser({ email: DEMO_EMAIL, name: 'Guest Roaster' }));
      return { user, isAdmin: true, demo: true };
    }

    const session = await getSession();
    const email = session?.user?.email;
    if (!email) return null;

    // The id rides in the token; the row is re-read so points, name and the
    // admin flag are always current rather than frozen at sign-in.
    let user = session.user?.id ? await getUser(session.user.id) : null;
    if (!user || user.email.toLowerCase() !== email.toLowerCase()) {
      user = await upsertOAuthUser({
        email,
        name: session.user?.name ?? null,
        image: session.user?.image ?? null,
      });
    }
    return { user, isAdmin: user.isAdmin || isAdminEmail(email), demo: false };
  } catch (err) {
    console.error('viewer_lookup_failed', err);
    return null;
  }
});

/** A signed-in guest owns the orders placed under their account or their email. */
export function ownsOrder(viewer: Viewer | null, order: Pick<Order, 'userId' | 'guestEmail'>): boolean {
  if (!viewer) return false;
  if (order.userId && order.userId === viewer.user.id) return true;
  return !!order.guestEmail && order.guestEmail.toLowerCase() === viewer.user.email.toLowerCase();
}

/**
 * What a tracking or confirmation page may ship to the browser. Those URLs
 * are the guest's to share ("where's my coffee?"), so the payload carries
 * what the page draws — never the email, and only the tail of the phone.
 */
export function publicOrderView(order: Order): Order {
  const digits = order.guestPhone?.replace(/\D/g, '') ?? '';
  return {
    ...order,
    userId: null,
    guestEmail: null,
    guestName: order.guestName?.trim().split(/\s+/)[0] ?? null,
    guestPhone: digits.length >= 4 ? `•••• ${digits.slice(-4)}` : null,
  };
}
