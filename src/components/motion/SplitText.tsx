'use client';
/**
 * Word-by-word `mask` reveal — the tagline block on `/` (§14.6) and section
 * openers elsewhere. Words are wrapped in spans with `overflow: clip`, so the
 * text is still one selectable, screen-reader-readable string.
 *
 * NEVER used on the LCP element. Reveal the content AROUND the headline
 * instead (§14.3, §16.2).
 */
import { useRef } from 'react';
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
        const tween = gsap.from(targets, {
          yPercent: 115,
          opacity: 0,
          duration: 0.85,
          ease: EASE.aura,
          stagger: { each: stagger, amount: Math.min(words.length * stagger, 0.6) },
          scrollTrigger: { trigger: el, start, once: true },
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
      {words.map((w, i) => (
        <span key={`${w}-${i}`} data-word className="split__word">
          <span>{w}</span>
          {i < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </Component>
  );
}
