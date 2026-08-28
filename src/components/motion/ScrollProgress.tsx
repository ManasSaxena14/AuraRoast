'use client';
/**
 * The header scroll-progress Halo (Blueprint §14.6 — Global).
 *
 * Driven by `animation-timeline: scroll(root block)` where the browser
 * supports it: no JS, no scroll listener, no rAF. The rAF fallback below only
 * runs where the native timeline is unavailable.
 */
import { useEffect, useRef, useState } from 'react';

const R = 11;
const C = 2 * Math.PI * R;

export function ScrollProgress() {
  const ref = useRef<SVGCircleElement>(null);
  const [needsJs, setNeedsJs] = useState(false);

  useEffect(() => {
    const supported =
      typeof CSS !== 'undefined' && CSS.supports?.('animation-timeline', 'scroll(root block)');
    if (supported) return;
    setNeedsJs(true);

    let raf = 0;
    const update = () => {
      const el = ref.current;
      if (el) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
        el.style.strokeDashoffset = String(C * (1 - p));
      }
      raf = 0;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <svg className="scroll-halo" viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
      <circle cx="14" cy="14" r={R} fill="none" stroke="var(--aura-500)" strokeWidth="1.5" opacity="0.16" />
      <circle
        ref={ref}
        className={needsJs ? undefined : 'scroll-halo__progress'}
        cx="14"
        cy="14"
        r={R}
        fill="none"
        stroke="var(--aura-500)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={C}
        transform="rotate(-90 14 14)"
      />
    </svg>
  );
}
