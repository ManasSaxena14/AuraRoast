'use client';
/**
 * A control that leans toward the pointer and springs back when it leaves.
 *
 * Rationed to primary CTAs only — used on every button it stops meaning
 * anything.
 *
 * The whole effect lives inside one matchMedia query rather than an early
 * return, so it is torn down and rebuilt for free when the guest turns
 * reduced-motion on, plugs in a mouse, or rotates a hybrid tablet into laptop
 * mode. An early `if (prefersReducedMotion()) return` is only ever evaluated
 * once, at mount.
 */
import { useRef, type ReactNode } from 'react';
import { EASE, gsap, useGSAP } from './gsap';

/** Hover-capable, fine pointer, motion allowed — all three, or nothing. */
const POINTER_QUERY =
  '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)';

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
      const mm = gsap.matchMedia();

      mm.add(POINTER_QUERY, () => {
        const move = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          // Promote only while the pointer is on it (§16.3) — a CTA that sits
          // in the footer of every page would otherwise hold a compositor
          // layer for the life of the session.
          el.dataset.magneticActive = 'true';
          gsap.to(el, {
            x: (e.clientX - (r.left + r.width / 2)) * strength,
            y: (e.clientY - (r.top + r.height / 2)) * strength,
            duration: 0.4,
            ease: EASE.aura,
            overwrite: 'auto',
          });
        };
        const reset = () => {
          gsap.to(el, {
            x: 0,
            y: 0,
            duration: 0.6,
            ease: EASE.bloom,
            overwrite: 'auto',
            // Drop the promotion at rest, not on pointerleave: the spring is
            // still running for 600ms after the pointer has gone.
            onComplete: () => {
              delete el.dataset.magneticActive;
              gsap.set(el, { clearProps: 'transform' });
            },
          });
        };

        el.addEventListener('pointermove', move);
        el.addEventListener('pointerleave', reset);
        // A pointer that is cancelled (stylus lifted, gesture stolen by the
        // browser) never fires pointerleave, and the control would stay leaning.
        el.addEventListener('pointercancel', reset);

        return () => {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerleave', reset);
          el.removeEventListener('pointercancel', reset);
          gsap.killTweensOf(el);
          delete el.dataset.magneticActive;
          gsap.set(el, { clearProps: 'transform' });
        };
      });

      return () => mm.revert();
    },
    { scope: ref, dependencies: [strength] },
  );

  return (
    <span ref={ref} className={`magnetic${className ? ` ${className}` : ''}`}>
      {children}
    </span>
  );
}
