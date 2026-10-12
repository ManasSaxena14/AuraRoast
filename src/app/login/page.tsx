import Link from 'next/link';
import type { Metadata } from 'next';
import { features } from '@/config/env';
import { getViewer } from '@/lib/session';
import { Logo } from '@/components/layout/Logo';
import { AuthBackdrop, AuthCard } from '@/components/auth/AuthCard';
import { signInWithGoogle, signOutAction } from './actions';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** Auth.js redirects here with `?error=<code>`; the guest gets a sentence, not a code. */
const ERRORS: Record<string, string> = {
  AccessDenied: 'That Google account could not be used — it needs a verified email address.',
  Configuration:
    'Sign-in is not set up correctly on the server. Nothing is wrong with your account — try again shortly.',
  Verification: 'That sign-in link has expired. Start again.',
  OAuthCallbackError: 'Google did not complete the sign-in. Try again.',
  OAuthSignInError: 'Google did not complete the sign-in. Try again.',
  CallbackRouteError: 'Google did not complete the sign-in. Try again.',
};

/**
 * Google OAuth is the only sign-in (Blueprint §5.1): no password storage, no
 * reset flow, no credential-stuffing surface. Guest checkout stays open, which
 * is why nothing on the ordering path is gated behind this page.
 *
 * A server component with server actions: the sign-in button needs no client
 * JavaScript, and whether it is enabled is decided where the credentials live.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; mode?: string }>;
}) {
  const { callbackUrl, error, mode } = await searchParams;
  const redirectTo =
    callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : '/account';
  const viewer = features.googleAuth ? await getViewer() : null;
  const message = error ? (ERRORS[error] ?? 'Sign-in did not complete. Try again.') : null;
  const signedIn = viewer && !viewer.demo;
  // Sent here from a gated action: say which one, so sign-in reads as a step
  // on the way, not a wall.
  const reason = redirectTo.startsWith('/checkout')
    ? 'Sign in to place your order — your cart is saved.'
    : redirectTo.startsWith('/reservations')
      ? 'Sign in to hold your table.'
      : redirectTo.startsWith('/menu/')
        ? 'Sign in to write a review.'
        : redirectTo.startsWith('/admin')
          ? 'Staff sign-in.'
          : null;

  return (
    <div className="auth">
      <AuthBackdrop />

      <section className="auth__story">
        <div data-auth-in style={{ '--d': 0 } as React.CSSProperties}>
          <Logo size={72} layout="stacked" tagline animate />
        </div>
        <p className="eyebrow" data-auth-in style={{ '--d': 1, marginBottom: 0 } as React.CSSProperties}>
          {signedIn ? 'Signed in' : 'Your Halo'}
        </p>
        <h1 data-auth-in style={{ '--d': 1 } as React.CSSProperties}>
          {signedIn ? 'Good to see you again.' : 'Every cup, remembered.'}
        </h1>
        <ul className="auth__perks">
          {[
            ['◎', 'Points on every order', 'One point per ₹10 — the Halo fills through four tiers.'],
            ['↻', 'Standing beans', 'Weekly, fortnightly or monthly. Skip or pause any time.'],
            ['⌖', 'Orders on every device', 'Track, cancel and reorder wherever you sign in.'],
          ].map(([glyph, title, detail], i) => (
            <li key={title} data-auth-in style={{ '--d': 2 + i } as React.CSSProperties}>
              <span aria-hidden="true">{glyph}</span>
              <span>
                {title}
                <small>{detail}</small>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {signedIn ? (
        <div className="auth-card" data-auth-in style={{ '--d': 3 } as React.CSSProperties}>
          <h2>You are signed in.</h2>
          <p className="muted">
            As {viewer.user.name} · <span className="mono">{viewer.user.email}</span>
          </p>
          <Link href={redirectTo} className="btn btn--primary btn--lg btn--block">
            Continue
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="btn btn--outline btn--block">
              Sign out
            </button>
          </form>
        </div>
      ) : (
        <AuthCard
          action={signInWithGoogle}
          redirectTo={redirectTo}
          enabled={features.googleAuth}
          message={message}
          reason={reason}
          initialTab={mode === 'signup' ? 'signup' : 'signin'}
        />
      )}
    </div>
  );
}
