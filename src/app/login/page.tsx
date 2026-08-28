import Link from 'next/link';
import type { Metadata } from 'next';
import { features } from '@/config/env';
import { Logo } from '@/components/layout/Logo';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * Google OAuth is the only sign-in (Blueprint §5.1): no password storage, no
 * reset flow, no credential-stuffing surface. Guest checkout stays open, which
 * is why nothing on the ordering path is gated behind this page.
 *
 * The Halo draws once and rests. Nothing else moves (§14.6).
 */
export default function LoginPage() {
  return (
    <div className="login">
      <div style={{ justifySelf: 'center' }}>
        <Logo size={104} layout="stacked" tagline animate />
      </div>
      <h1 style={{ fontSize: 'var(--text-2xl)' }}>Sign in.</h1>
      <p className="lede" style={{ marginInline: 'auto', maxWidth: '38ch' }}>
        Google only. We store no passwords, which means there is no reset flow to phish and no
        credential list to leak.
      </p>

      <div className="stack" style={{ maxWidth: 360, marginInline: 'auto', width: '100%' }}>
        <button className="btn btn--primary btn--lg btn--block" disabled={!features.googleAuth}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="currentColor"
              d="M21.35 11.1H12v2.8h5.35c-.24 1.4-1.7 4.1-5.35 4.1a5.9 5.9 0 1 1 0-11.8c1.7 0 2.85.72 3.5 1.34l2.4-2.3C16.4 3.9 14.4 3 12 3a9 9 0 1 0 0 18c5.2 0 8.65-3.65 8.65-8.8 0-.6-.1-1.05-.3-1.1Z"
            />
          </svg>
          Continue with Google
        </button>
        {!features.googleAuth ? (
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            Google OAuth is not configured in this environment. Add{' '}
            <code className="mono">AUTH_GOOGLE_ID</code> and{' '}
            <code className="mono">AUTH_GOOGLE_SECRET</code> to enable it — everything else on the
            site works without an account.
          </p>
        ) : null}
        <Link href="/account" className="btn btn--outline btn--block">
          Continue as guest
        </Link>
      </div>

      <p className="muted" style={{ fontSize: 11, maxWidth: '44ch', marginInline: 'auto' }}>
        You never need an account to order. Guest checkout keeps the tracking link in your email
        and nothing else.
      </p>
    </div>
  );
}
