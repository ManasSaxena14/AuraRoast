'use client';
/**
 * "Brewing now" — how many rooms are open this minute, on the shop's (IST)
 * clock. Rendered after mount: the footer is on prerendered pages, and a
 * clock read during render would bake the build minute into the HTML.
 */
import { useEffect, useState } from 'react';
import { STORES, DEFAULT_STORE } from '@/data/stores';
import { openState } from '@/lib/hours';

export function FooterLive() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!now) return <p className="footer-live" aria-hidden="true">&nbsp;</p>;
  const active = STORES.filter((s) => s.isActive);
  const open = active.filter((s) => openState(s, now).open).length;
  const flagship = openState(DEFAULT_STORE, now);

  return (
    <p className="footer-live" data-open={open > 0 || undefined}>
      <span className="footer-live__dot" aria-hidden="true" />
      {open > 0 ? (
        <>
          <strong>{open}</strong> of {active.length} bars brewing now
        </>
      ) : (
        <>All bars closed — {DEFAULT_STORE.name} {flagship.label.toLowerCase()}</>
      )}
    </p>
  );
}
