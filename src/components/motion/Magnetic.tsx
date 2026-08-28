'use client';
/**
 * A control that leans toward the pointer and springs back when it leaves.
 *
 * Rationed to primary CTAs only — used on every button it stops meaning
 * anything. Pointer-driven, so it is disabled entirely on coarse pointers
 * (where there is no hover to respond to) and under reduced motion.
 */
import { useRef, type ReactNode } from 'react';
import { EASE, gsap, prefersReducedMotion, useGSAP } from './gsap';

export function Magnetic({
  children,
  strength = 0.28,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      if (prefersReducedMotion()) return;
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        gsap.to(el, {
          x: (e.clientX - (r.left + r.width / 2)) * strength,
          y: (e.clientY - (r.top + r.height / 2)) * strength,
          duration: 0.4,
          ease: EASE.aura,
          overwrite: 'auto',
        });
      };
      const reset = () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: EASE.bloom, overwrite: 'auto' });
      };

      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', reset);
      return () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerleave', reset);
        gsap.set(el, { clearProps: 'transform' });
      };
    },
    { scope: ref, dependencies: [strength] },
  );

  return (
    <span ref={ref} className={`magnetic${className ? ` ${className}` : ''}`}>
      {children}
    </span>
  );
}
