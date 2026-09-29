'use client';
/** Appears past two viewport heights; scrolls via lenis.scrollTo(0) (§14.6). */
import { useEffect, useState } from 'react';
import { scrollTo } from '@/components/motion/SmoothScroll';

export function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let last: boolean | null = null;
    const onScroll = () => {
      const next = window.scrollY > window.innerHeight * 2;
      if (next === last) return; // a render per crossing, not per scroll frame
      last = next;
      setShow(next);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      className="back-to-top"
      data-show={show || undefined}
      onClick={() => scrollTo(0)}
      aria-label="Back to top"
      tabIndex={show ? 0 : -1}
    >
      <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
        <circle cx="20" cy="20" r="18" fill="none" stroke="var(--aura-500)" strokeWidth="1.2" opacity="0.5" />
        <path d="M20 26V14m0 0l-5 5m5-5l5 5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </button>
  );
}
