'use client';
/**
 * The header's account entry. Signed in, it is the guest's own face (or
 * initial); signed out, it says "Sign in" and goes there.
 *
 * Reads the session context directly rather than through `useSession()`,
 * which throws when there is no provider — and there deliberately is none
 * when sign-in is not configured (see providers.tsx).
 */
import Link from 'next/link';
import { useContext } from 'react';
import { SessionContext } from 'next-auth/react';

export function AccountLink({ className, mobile = false }: { className?: string; mobile?: boolean }) {
  const ctx = useContext(SessionContext);
  const user = ctx?.status === 'authenticated' ? ctx.data?.user : null;

  // No provider at all: sign-in is off, and /account is the demo profile.
  if (!ctx) {
    return (
      <Link href="/account" className={className}>
        Account
      </Link>
    );
  }

  if (!user) {
    return (
      <Link href="/login" className={className} aria-busy={ctx.status === 'loading' || undefined}>
        {ctx.status === 'loading' ? 'Account' : 'Sign in'}
      </Link>
    );
  }

  const name = user.name || user.email || 'Account';
  return (
    <Link href="/account" className={className} aria-label={`Your account — ${name}`} title={name}>
      {!mobile ? (
        user.image ? (
          // A Google avatar URL; plain <img> so no remote-image config is needed.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt=""
            width={24}
            height={24}
            referrerPolicy="no-referrer"
            className="account-avatar"
          />
        ) : (
          <span className="account-avatar account-avatar--initial" aria-hidden="true">
            {name.charAt(0).toUpperCase()}
          </span>
        )
      ) : null}
      <span>{mobile ? 'Your account' : name.split(' ')[0]}</span>
    </Link>
  );
}
