'use client';
/**
 * <Reveal> — THE scroll primitive (Blueprint §14.3).
 *
 * Every scroll-triggered content reveal on this site goes through this
 * component. Not a hook per page, not a bespoke ScrollTrigger per section.
 * One primitive, one trigger point.
 *
 * Rules encoded here rather than left to discipline:
 *   · `once: true` — content reveals never replay on scroll-up
 *   · `start: 'top 85%'` — a single trigger point site-wide is what makes the
 *     rhythm feel intentional rather than accumulated
 *   · total stagger capped at 300ms regardless of list length, so a 30-item
 *     grid and a 6-item grid finish in the same window
 *   · a reduced-motion branch that sets the VISIBLE final state instantly
 *   · every animated property is cleared on completion, so a revealed element
 *     is left with no inline transform, filter or clip-path of its own
 *
 * API — two props do the work:
 *   variant  which way it arrives
 *   stagger  present ⇒ the CHILDREN arrive one after another; absent ⇒ the
 *            element arrives as one object. `variant="stagger"` is shorthand
 *            for `variant="rise"` + the default stagger.
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

/**
 * Each variant is an explicit from → to pair. `fromTo`, never `from`: a bare
 * `from` reads its end value off the computed style, and for `clip-path` that
 * value is the keyword `none`, which has no numeric relationship to an
 * `inset()` and cannot be interpolated toward.
 */
const VARIANTS: Record<RevealVariant, { from: gsap.TweenVars; to: gsap.TweenVars }> = {
  rise: { from: { y: 24, opacity: 0 }, to: { y: 0, opacity: 1 } },
  fade: { from: { opacity: 0 }, to: { opacity: 1 } },
  // For headlines: the type is uncovered rather than moved onto the page.
  mask: {
    from: { clipPath: 'inset(0% 0% 100% 0%)', y: 12, opacity: 1 },
    to: { clipPath: 'inset(0% 0% 0% 0%)', y: 0, opacity: 1 },
  },
  scale: { from: { scale: 0.96, opacity: 0 }, to: { scale: 1, opacity: 1 } },
  stagger: { from: { y: 20, opacity: 0 }, to: { y: 0, opacity: 1 } },
  blur: {
    from: { opacity: 0, filter: 'blur(10px)', y: 12 },
    to: { opacity: 1, filter: 'blur(0px)', y: 0 },
  },
  // Wipes open left → right. Opacity stays at 1 throughout: the edge of the
  // wipe is the effect, and cross-fading it turns a hard reveal into a smudge.
  clip: {
    from: { clipPath: 'inset(0% 100% 0% 0%)', opacity: 1 },
    to: { clipPath: 'inset(0% 0% 0% 0%)', opacity: 1 },
  },
  flip: {
    from: { rotateX: -38, y: 28, opacity: 0, transformPerspective: 900 },
    to: { rotateX: 0, y: 0, opacity: 1 },
  },
  slide: { from: { x: -36, opacity: 0 }, to: { x: 0, opacity: 1 } },
};

/** Everything a variant is allowed to touch — and therefore everything the
 *  reduced-motion branch has to be able to hand back. */
const OWNED_PROPS = 'transform,filter,clipPath,opacity,visibility';

const DEFAULT_STAGGER = 0.05;

export interface RevealProps {
  variant?: RevealVariant;
  delay?: number;
  /**
   * Passing this at all opts the element's DIRECT CHILDREN in as the animation
   * targets, whatever the variant — a `flip` grid flips card by card. Leave it
   * off and the element arrives as a single object.
   */
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
  stagger,
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

      // `variant="stagger"` is the legacy spelling of "rise, child by child".
      const perChild = variant === 'stagger' || stagger !== undefined;
      const kids = Array.from(el.children);
      // An element with no children still has to reveal — fall back to itself
      // rather than handing GSAP an empty target list and never showing.
      const targets: Element | Element[] = perChild && kids.length ? kids : el;
      const count = Array.isArray(targets) ? targets.length : 1;
      const step = stagger ?? DEFAULT_STAGGER;
      const spec = VARIANTS[variant];

      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        el.dataset.revealReady = 'true';
        let tween: gsap.core.Tween;
        // eslint-disable-next-line prefer-const
        tween = gsap.fromTo(targets, spec.from, {
          ...spec.to,
          duration: 0.72,
          ease: EASE.aura,
          delay,
          force3D: true,
          // Capped, not per-item: a long list must never make the guest wait
          // for an animation to catch up.
          stagger:
            count > 1
              ? { each: step, from: 'start', amount: Math.min(count * step, 0.3) }
              : 0,
          scrollTrigger: { trigger: el, start, once: true },
          onStart: () => {
            el.dataset.animating = 'true';
          },
          onComplete: () => {
            delete el.dataset.animating;
            // Retire the tween the moment it has played.
            //
            // `once: true` kills the ScrollTrigger but leaves the tween alive,
            // and a `fromTo` keeps its from-state renderable. Any later
            // ScrollTrigger.refresh() — which a lazy image landing and resizing
            // the page fires routinely — re-renders it back to `from`, with no
            // trigger left to play it forward. The element then sits at
            // opacity 0 permanently: on a 12-image page that stranded 12 of 15
            // reveals. A killed tween cannot be re-rendered.
            tween.scrollTrigger?.kill();
            tween.kill();
            // Nothing survives the reveal. An inline `transform: translate(0)`
            // left behind would silently make the element a containing block
            // for any fixed-position descendant (§16.3). Opacity is cleared too
            // so the element is left on its own CSS, not an inline value.
            gsap.set(targets, { clearProps: OWNED_PROPS + ',willChange' });
          },
        });
        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
          // A tween killed mid-flight never reaches onComplete, and the
          // attribute is what carries `will-change` in CSS.
          delete el.dataset.animating;
        };
      });

      // §14.7 rule 8 — every scroll animation has a reduced-motion branch that
      // lands on the VISIBLE end state. Content left at opacity 0 here is not a
      // missing flourish, it is missing content.
      mm.add('(prefers-reduced-motion: reduce)', () => {
        el.dataset.revealReady = 'true';
        // Nothing is ever applied in this branch, so the correct end state is
        // "no inline state at all" — the element's own CSS. The clear is for
        // the case where the preference flips mid-session and the motion
        // branch has already written a hidden from-state.
        gsap.set(targets, { clearProps: OWNED_PROPS });
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
