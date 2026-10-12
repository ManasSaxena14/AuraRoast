'use client';
/**
 * A hairline of light across the top of the page while a route loads.
 *
 * The View Transition only starts once the next route has committed, so on a
 * slow link the tap used to look ignored for a beat. This starts on the tap
 * itself (any same-origin link, captured before Next handles it), creeps
 * toward 90% while waiting, and completes the moment the URL changes.
 */
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const started = useRef<string | null>(null);

  useEffect(() => {
    const clear = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const next = url.pathname + url.search;
      if (next === window.location.pathname + window.location.search) return;
      clear();
      started.current = next;
      setState('loading');
      // A navigation that never lands (blocked, errored) must not leave the bar up.
      timers.current.push(setTimeout(() => setState('idle'), 10_000));
    };
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      clear();
    };
  }, []);

  useEffect(() => {
    if (!started.current) return;
    started.current = null;
    timers.current.forEach(clearTimeout);
    setState('done');
    timers.current = [setTimeout(() => setState('idle'), 450)];
  }, [pathname, search]);

  return <div className="nav-progress" data-state={state} aria-hidden="true" />;
}
