'use client';
/**
 * <Reveal> — THE scroll primitive (Blueprint §14.3).
 *
 * Every scroll-triggered content reveal on this site goes through this
 * component. Not a hook per page, not a bespoke ScrollTrigger per section.
 * One primitive, five variants, one trigger point.
 *
 * Rules encoded here rather than left to discipline:
 *   · `once: true` — content reveals never replay on scroll-up
 *   · `start: 'top 85%'` — a single trigger point site-wide is what makes the
 *     rhythm feel intentional rather than accumulated
 *   · total stagger capped at 300ms regardless of list length, so a 30-item
 *     grid and a 6-item grid finish in the same window
 *   · a reduced-motion branch that sets the final state instantly
 */
import { useEffect, useRef, type ElementType, type ReactNode } from 'react';
import { EASE, gsap, useGSAP } from './gsap';

export type RevealVariant =
  | 'rise'
  | 'fade'
  | 'mask'
  | 'scale'
  | 'stagger'
  | 'blur'
  | 'clip'
  | 'flip'
  | 'slide';

const VARIANTS: Record<RevealVariant, gsap.TweenVars> = {
  rise: { y: 24, opacity: 0 },
  fade: { opacity: 0 },
  mask: { clipPath: 'inset(0 0 100% 0)', y: 12, opacity: 1 }, // for headlines
  scale: { scale: 0.96, opacity: 0 },
  stagger: { y: 20, opacity: 0 },
  blur: { opacity: 0, filter: 'blur(10px)', y: 12 },
  clip: { clipPath: 'inset(0 100% 0 0)', opacity: 1 }, // wipes open left → right
  flip: { rotateX: -38, y: 28, opacity: 0, transformPerspective: 900 },
  slide: { x: -36, opacity: 0 },
};

export interface RevealProps {
  variant?: RevealVariant;
  delay?: number;
  stagger?: number;
  /** 'top 85%' everywhere by default — override only for a pinned context. */
  start?: string;
  as?: ElementType;
  className?: string;
  children: ReactNode;
  id?: string;
  style?: React.CSSProperties;
}

export function Reveal({
  variant = 'rise',
  delay = 0,
  stagger = 0.05,
  start = 'top 85%',
  as: Tag = 'div',
  className,
  children,
  ...rest
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  // Watchdog. `[data-reveal]` is hidden in CSS until GSAP claims it, so if the
  // motion chunk fails to load the content would never appear at all. This
  // makes the worst case "it showed up without animating" rather than "it
  // never showed up".
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const t = setTimeout(() => {
      if (!el.dataset.revealReady) el.dataset.revealReady = 'true';
    }, 2500);
    return () => clearTimeout(t);
  }, []);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const targets = variant === 'stagger' ? Array.from(el.children) : el;
      const count = variant === 'stagger' ? el.children.length : 1;

      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        el.dataset.revealReady = 'true';
        const tween = gsap.from(targets, {
          ...VARIANTS[variant],
          ...(variant === 'mask' ? { clipPath: 'inset(0 0 100% 0)' } : {}),
          duration: 0.72,
          ease: EASE.aura,
          delay,
          force3D: true,
          // Capped, not per-item: a long list must never make the guest wait
          // for an animation to catch up.
          stagger:
            variant === 'stagger'
              ? { each: stagger, from: 'start', amount: Math.min(count * stagger, 0.3) }
              : 0,
          scrollTrigger: { trigger: el, start, once: true },
          onStart: () => {
            el.dataset.animating = 'true';
          },
          onComplete: () => {
            delete el.dataset.animating;
            gsap.set(targets, { clearProps: 'filter,willChange' });
          },
        });
        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
        };
      });

      // §14.7 rule 8 — every scroll animation has a reduced-motion branch that
      // sets the final state instantly.
      mm.add('(prefers-reduced-motion: reduce)', () => {
        el.dataset.revealReady = 'true';
        gsap.set(targets, { opacity: 1, y: 0, scale: 1, clipPath: 'none', filter: 'none' });
      });

      return () => mm.revert();
    },
    { scope: ref, dependencies: [variant, delay, stagger, start] },
  );

  const Component = Tag as ElementType;
  return (
    <Component ref={ref} data-reveal={variant} className={className} {...rest}>
      {children}
    </Component>
  );
}
