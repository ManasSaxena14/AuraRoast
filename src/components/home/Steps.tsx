'use client';
/**
 * "How it works" — steps reveal in sequence and a connecting line draws
 * between them, `stroke-dashoffset` scrubbed (§14.6). The line is a scaled
 * transform rather than a stroke so it costs the compositor nothing.
 */
import Link from 'next/link';
import { useRef } from 'react';
import { gsap, useGSAP } from '@/components/motion/gsap';
import { Reveal } from '@/components/motion/Reveal';
import { HOW_IT_WORKS } from '@/data/content';

export function Steps() {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const st = gsap.to(el, {
          ease: 'none', // scroll-linked: no easing curve, ever (§12.4)
          scrollTrigger: {
            trigger: el,
            start: 'top 75%',
            end: 'bottom 65%',
            scrub: true,
            onUpdate: (self) => el.style.setProperty('--steps-progress', String(self.progress)),
          },
        });
        return () => {
          st.scrollTrigger?.kill();
          st.kill();
        };
      });

      mm.add('(prefers-reduced-motion: reduce)', () => {
        el.style.setProperty('--steps-progress', '1');
      });

      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <div className="steps" ref={ref}>
      <div className="steps__line" aria-hidden="true">
        <i />
      </div>
      {HOW_IT_WORKS.map((s, i) => (
        <Reveal key={s.step} variant="rise" delay={i * 0.08} className="step">
          <span className="step__num mono">{s.step}</span>
          <div className="stack-sm">
            <h3>{s.title}</h3>
            <p className="muted">{s.body}</p>
            <Link href={s.href} className="link-arrow">
              {s.linkLabel}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </Reveal>
      ))}
    </div>
  );
}
