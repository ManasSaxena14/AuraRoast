'use client';
/**
 * A soft pool of light that follows the pointer across cards.
 *
 * ONE delegated listener for the whole document, writing two custom
 * properties on whichever card is under the pointer — no React state, no
 * per-card listeners, nothing at all on touch screens. The light itself is a
 * `::after` gradient in polish.css, so the card's own hover transform and
 * transitions are untouched.
 */
import { useEffect } from 'react';

const SELECTOR = '.drink-card, .pairing, .store-row';

export function Spotlight() {
  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    let last: PointerEvent | null = null;
    const paint = () => {
      frame = 0;
      const e = last;
      if (!e) return;
      const el = (e.target as Element | null)?.closest?.(SELECTOR) as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    const onMove = (e: PointerEvent) => {
      last = e;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      document.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
