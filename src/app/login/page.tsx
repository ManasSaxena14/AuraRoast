import Link from 'next/link';
import type { Metadata } from 'next';
import { features } from '@/config/env';
import { getViewer } from '@/lib/session';
import { Logo } from '@/components/layout/Logo';
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

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

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
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;
  const redirectTo =
    callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : '/account';
  const viewer = features.googleAuth ? await getViewer() : null;
  const message = error ? (ERRORS[error] ?? 'Sign-in did not complete. Try again.') : null;

  return (
    <div className="login">
      <div style={{ justifySelf: 'center' }}>
        <Logo size={104} layout="stacked" tagline animate />
      </div>

      {viewer && !viewer.demo ? (
        <>
          <h1 style={{ fontSize: 'var(--text-2xl)' }}>You are signed in.</h1>
          <p className="lede" style={{ marginInline: 'auto', maxWidth: '38ch' }}>
            As {viewer.user.name} · <span className="mono">{viewer.user.email}</span>
          </p>
          <div className="stack" style={{ maxWidth: 360, marginInline: 'auto', width: '100%' }}>
            <Link href={redirectTo} className="btn btn--primary btn--lg btn--block">
              Continue
            </Link>
            <form action={signOutAction}>
              <button type="submit" className="btn btn--outline btn--block">
                Sign out
              </button>
            </form>
          </div>
        </>
      ) : (
        <>
          <h1 style={{ fontSize: 'var(--text-2xl)' }}>Sign in.</h1>
          <p className="lede" style={{ marginInline: 'auto', maxWidth: '38ch' }}>
            Google only. We store no passwords — no reset flow to phish, no credential list to leak.
          </p>

          {message ? (
            <p className="field__error" role="alert" style={{ justifyContent: 'center', maxWidth: '44ch', marginInline: 'auto' }}>
              <span aria-hidden="true">⚠</span>
              {message}
            </p>
          ) : null}

          <div className="stack" style={{ maxWidth: 360, marginInline: 'auto', width: '100%' }}>
            <form action={signInWithGoogle}>
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <button
                type="submit"
                className="btn btn--primary btn--lg btn--block"
                disabled={!features.googleAuth}
              >
                <GoogleMark />
                Continue with Google
              </button>
            </form>

            {!features.googleAuth ? (
              <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                Google sign-in is not configured in this environment. Set{' '}
                <code className="mono">AUTH_SECRET</code>, <code className="mono">AUTH_GOOGLE_ID</code> and{' '}
                <code className="mono">AUTH_GOOGLE_SECRET</code> to enable it — everything else on the
                site works without an account.
              </p>
            ) : null}

            <Link href="/menu" className="btn btn--outline btn--block">
              Continue as guest
            </Link>
          </div>

          <p className="muted" style={{ fontSize: 11, maxWidth: '44ch', marginInline: 'auto' }}>
            You never need an account to order. Signing in keeps your orders, loyalty points and
            subscriptions together across devices.
          </p>
        </>
      )}
    </div>
  );
}
