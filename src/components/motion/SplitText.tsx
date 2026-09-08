'use client';
/**
 * Word-by-word `mask` reveal — the tagline block on `/` (§14.6) and section
 * openers elsewhere. Words are wrapped in spans with `overflow: clip`, so the
 * text is still one selectable, screen-reader-readable string.
 *
 * NEVER used on the LCP element. Reveal the content AROUND the headline
 * instead (§14.3, §16.2).
 */
import { Fragment, useRef } from 'react';
import { EASE, gsap, useGSAP } from './gsap';

export function SplitText({
  text,
  as: Tag = 'p',
  className,
  stagger = 0.06,
  start = 'top 85%',
}: {
  text: string;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
  className?: string;
  stagger?: number;
  start?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const words = text.split(' ');

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const targets = el.querySelectorAll('[data-word] > span');
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        let tween: gsap.core.Tween;
        // eslint-disable-next-line prefer-const
        tween = gsap.from(targets, {
          yPercent: 115,
          opacity: 0,
          duration: 0.85,
          ease: EASE.aura,
          stagger: { each: stagger, amount: Math.min(words.length * stagger, 0.6) },
          scrollTrigger: { trigger: el, start, once: true },
          onComplete: () => {
            // Same hazard as <Reveal>: `once: true` kills the trigger but not
            // the tween, and a later ScrollTrigger.refresh() (any lazy image
            // resizing the page) re-renders a `from` back to its hidden start
            // with nothing left to play it forward — which stranded every word
            // of every headline at opacity 0. Retire it once it has played.
            tween.scrollTrigger?.kill();
            tween.kill();
            gsap.set(targets, { clearProps: 'transform,opacity' });
          },
        });
        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
        };
      });

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(targets, { yPercent: 0, opacity: 1 });
      });

      return () => mm.revert();
    },
    { scope: ref, dependencies: [text, stagger, start] },
  );

  const Component = Tag as React.ElementType;
  return (
    <Component ref={ref} className={`split${className ? ` ${className}` : ''}`}>
      {/* The separator sits OUTSIDE `.split__word`: a trailing space inside an
          `overflow: hidden` inline-block collapses to zero width, and the words
          run together for readers and screen readers alike. */}
      {words.map((w, i) => (
        <Fragment key={`${w}-${i}`}>
          <span data-word className="split__word">
            <span>{w}</span>
          </span>
          {i < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </Component>
  );
}
