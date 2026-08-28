'use client';
import { useEffect } from 'react';
import { Halo } from '@/components/motion/Halo';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('route_error', error);
  }, [error]);

  return (
    <div className="login">
      <div style={{ justifySelf: 'center' }}>
        <Halo size={110} stroke={2} progress={0.7} />
      </div>
      <h1 style={{ fontSize: 'var(--text-2xl)' }}>That did not pour.</h1>
      <p className="lede" style={{ marginInline: 'auto', maxWidth: '40ch' }}>
        Something failed on our side. Nothing was charged and nothing was lost — try it again.
      </p>
      {error.digest ? (
        <p className="mono muted" style={{ fontSize: 11 }}>
          {error.digest}
        </p>
      ) : null}
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn btn--primary" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
