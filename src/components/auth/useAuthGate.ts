'use client';
/**
 * Is the visitor signed in — from a client component on a prerendered page?
 *
 *   'loading'  the session request is still in flight (render a placeholder)
 *   'in'       signed in, or zero-config local development (no Google
 *              credentials → no SessionProvider → the server treats every
 *              request as the demo account, so the client must too)
 *   'out'      signed out: offer sign-in instead of the gated action
 *
 * This only shapes the UI. Every gated action is refused by its API route
 * without a session — the client check is a courtesy, not the lock.
 */
import { useContext } from 'react';
import { SessionContext } from 'next-auth/react';

export type AuthGate = 'loading' | 'in' | 'out';

export function useAuthGate(): AuthGate {
  const session = useContext(SessionContext);
  if (!session) return 'in'; // auth not configured: local demo mode
  if (session.status === 'loading') return 'loading';
  return session.status === 'authenticated' ? 'in' : 'out';
}

/** `/login?callbackUrl=<here>` — sign in, then land back where you were. */
export function loginHref(callbackUrl: string, mode: 'signin' | 'signup' = 'signin'): string {
  const params = new URLSearchParams({ callbackUrl });
  if (mode === 'signup') params.set('mode', 'signup');
  return `/login?${params.toString()}`;
}
