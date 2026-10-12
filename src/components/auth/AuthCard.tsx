'use client';
/**
 * The sign-in / create-account card.
 *
 * Google is the only identity provider (no passwords to store or leak), so
 * the two tabs are the SAME action with different words: a new Google account
 * is created on first sign-in. The tabs exist because people look for "Sign
 * up" — and finding only "Sign in" reads as "this is not for me yet".
 */
import Link from 'next/link';
import { useState } from 'react';
import { BeanCanvas } from '@/components/three/BeanCanvas';

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

/** The slowly turning, already-roasted bean field behind the page. */
export function AuthBackdrop() {
  return (
    <div className="auth__backdrop" aria-hidden="true">
      <BeanCanvas count={120} roast={0.7} drift={0.55} />
    </div>
  );
}

export function AuthCard({
  action,
  redirectTo,
  enabled,
  message,
  reason = null,
  initialTab = 'signin',
}: {
  action: (formData: FormData) => Promise<void>;
  redirectTo: string;
  enabled: boolean;
  message: string | null;
  /** Why the visitor was sent here — "Sign in to place your order". */
  reason?: string | null;
  initialTab?: 'signin' | 'signup';
}) {
  const [tab, setTab] = useState<'signin' | 'signup'>(initialTab);
  const [pending, setPending] = useState(false);
  const signup = tab === 'signup';

  return (
    <div className="auth-card" data-auth-in style={{ '--d': 3 } as React.CSSProperties}>
      {reason ? (
        <p className="auth-card__reason" role="status">
          <span aria-hidden="true">◉</span>
          {reason}
        </p>
      ) : null}
      <div className="auth-tabs" role="tablist" aria-label="Sign in or create an account" data-tab={tab}>
        <span className="auth-tabs__pill" aria-hidden="true" />
        <button type="button" role="tab" aria-selected={!signup} onClick={() => setTab('signin')}>
          Sign in
        </button>
        <button type="button" role="tab" aria-selected={signup} onClick={() => setTab('signup')}>
          Create account
        </button>
      </div>

      {/* Keyed so the copy re-animates when the tab changes. */}
      <div className="auth-card__panel" key={tab} role="tabpanel">
        <h2>{signup ? 'Start your Halo.' : 'Welcome back.'}</h2>
        <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
          {signup
            ? 'One tap with Google opens your account — your orders, points and subscriptions start here.'
            : 'Your orders, loyalty points and standing beans, on every device.'}
        </p>

        {message ? (
          <p className="field__error" role="alert" style={{ justifyContent: 'center' }}>
            <span aria-hidden="true">⚠</span>
            {message}
          </p>
        ) : null}

        <form action={action} onSubmit={() => setPending(true)}>
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <button
            type="submit"
            className="btn btn--lg btn--block auth-card__google"
            disabled={!enabled || pending}
            aria-busy={pending || undefined}
          >
            <GoogleMark />
            {pending ? 'Opening Google…' : signup ? 'Sign up with Google' : 'Continue with Google'}
          </button>
        </form>

        {!enabled ? (
          <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>
            Google sign-in is not configured here. Set <code className="mono">AUTH_SECRET</code>,{' '}
            <code className="mono">AUTH_GOOGLE_ID</code> and <code className="mono">AUTH_GOOGLE_SECRET</code>.
          </p>
        ) : null}

        <div className="auth-card__divider">or</div>

        <Link href="/menu" className="btn btn--outline btn--block">
          Keep browsing
        </Link>
      </div>

      <p className="auth-card__fine">
        <strong>No password, ever.</strong> We never see or store one — nothing to reset, nothing to
        leak. Browse freely — an account is only needed to order, book or review.
      </p>
    </div>
  );
}
