'use client';
/**
 * /guides/[slug] (Blueprint §14.6).
 *
 *   · the step timeline is scroll-linked — the active step highlights as it
 *     reaches 40% of viewport height, and a progress line draws under
 *     `--ease-scrub` (i.e. no easing at all)
 *   · the TIMER is sticky and is never scroll-animated. A running timer that
 *     moves is unreadable, and that is the whole reason for the rule.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { gsap, useGSAP } from '@/components/motion/gsap';
import { Button } from '@/components/ui/Button';
import { Halo } from '@/components/motion/Halo';
import type { Guide } from '@/domain/types';

function mmss(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function GuideRunner({ guide }: { guide: Guide }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [timerStep, setTimerStep] = useState(0);

  const step = guide.steps[timerStep];
  const stepSeconds = Math.min(step?.seconds ?? 60, 600); // an 18h steep is not a timer

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!running || elapsed < stepSeconds) return;
    if (timerStep < guide.steps.length - 1) {
      setTimerStep((s) => s + 1);
      setElapsed(0);
    } else {
      setRunning(false);
    }
  }, [elapsed, stepSeconds, running, timerStep, guide.steps.length]);

  const reset = useCallback(() => {
    setRunning(false);
    setElapsed(0);
    setTimerStep(0);
  }, []);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;
      const steps = Array.from(root.querySelectorAll<HTMLElement>('.guide-step'));
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // The progress line, scrubbed. `ease: 'none'` — the scroll is the
        // timing function (§12.4).
        const line = gsap.to(root, {
          ease: 'none',
          scrollTrigger: {
            trigger: root,
            start: 'top 60%',
            end: 'bottom 70%',
            scrub: true,
            onUpdate: (self) =>
              document.documentElement.style.setProperty('--guide-progress', String(self.progress)),
          },
        });

        const triggers = steps.map((el, i) =>
          gsap.to(el, {
            ease: 'none',
            scrollTrigger: {
              trigger: el,
              start: 'top 40%',
              end: 'bottom 40%',
              onEnter: () => setActiveStep(i),
              onEnterBack: () => setActiveStep(i),
            },
          }),
        );

        return () => {
          line.scrollTrigger?.kill();
          line.kill();
          triggers.forEach((t) => {
            t.scrollTrigger?.kill();
            t.kill();
          });
        };
      });

      mm.add('(prefers-reduced-motion: reduce)', () => {
        document.documentElement.style.setProperty('--guide-progress', '1');
      });

      return () => mm.revert();
    },
    { scope: rootRef },
  );

  return (
    <>
      <div className="guide-progress" aria-hidden="true">
        <i />
      </div>

      <div className="timer" role="timer" aria-live="off">
        <Halo
          size={44}
          stroke={2}
          progress={running ? Math.min(1, elapsed / stepSeconds) : 0}
          animateOnMount={false}
        />
        <div className="stack-sm" style={{ gap: 2, flex: 1 }}>
          <span className="timer__value">{mmss(running || elapsed ? stepSeconds - elapsed : stepSeconds)}</span>
          <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
            Step {timerStep + 1} · {guide.steps[timerStep]?.title}
          </span>
        </div>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <Button size="sm" variant={running ? 'outline' : 'primary'} onClick={() => setRunning((r) => !r)}>
            {running ? 'Pause' : elapsed ? 'Resume' : 'Start'}
          </Button>
          <Button size="sm" variant="ghost" onClick={reset}>
            Reset
          </Button>
        </div>
      </div>

      <div className="guide-steps" ref={rootRef}>
        {guide.steps.map((s, i) => (
          <article key={s.index} className="guide-step" data-active={i === activeStep || undefined}>
            <span className="guide-step__index">{String(s.index).padStart(2, '0')}</span>
            <div className="stack-sm">
              <div className="row-between">
                <h3 style={{ fontSize: 'var(--text-base)' }}>{s.title}</h3>
                <span className="mono muted" style={{ fontSize: 'var(--text-xs)' }}>
                  {s.seconds >= 3600 ? `${Math.round(s.seconds / 3600)}h` : mmss(s.seconds)}
                </span>
              </div>
              <p className="muted">{s.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
