'use client';
/**
 * "Green to roast" — a 3D field of beans that roasts as you scroll.
 *
 * The section is three screens tall with a CSS-sticky stage inside it, and
 * ONE scrubbed ScrollTrigger maps its progress onto everything: the beans'
 * colour (three.js), the drum temperature, the stage name and the curve.
 * No GSAP pin — the home page already spends its pins on the hero and the
 * ritual — and no React state per frame: the temperature and the curve are
 * written straight to the DOM, and React re-renders only when the stage
 * NAME changes, six times in the whole section.
 */
import Link from 'next/link';
import { useRef, useState } from 'react';
import { ScrollTrigger, gsap, useGSAP } from '@/components/motion/gsap';
import { BeanCanvas, type BeanCanvasHandle } from '@/components/three/BeanCanvas';

const STAGES = [
  { at: 0.0, temp: 25, name: 'Green', note: 'Dense, grassy, 11% water. Nothing you would want to drink yet.' },
  { at: 0.18, temp: 160, name: 'Drying', note: 'Four minutes of patience. The water leaves; the bean turns straw-pale.' },
  { at: 0.36, temp: 175, name: 'Yellowing', note: 'Smells like toast and hay. Sugars begin to brown.' },
  { at: 0.55, temp: 196, name: 'First crack', note: 'An audible pop. The bean doubles in size — and becomes coffee.' },
  { at: 0.74, temp: 208, name: 'Development', note: 'Ninety seconds that decide sweetness against acidity. We stop early.' },
  { at: 0.9, temp: 216, name: 'Rested', note: 'Out of the drum, cooled in four minutes, rested nine days before it pours.' },
] as const;

/** Temperature along the roast — a real-shaped curve, not a straight line. */
function tempAt(p: number): number {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    const a = STAGES[i];
    if (p >= a.at) {
      const b = STAGES[i + 1];
      if (!b) return a.temp;
      const k = (p - a.at) / (b.at - a.at);
      return a.temp + (b.temp - a.temp) * (1 - (1 - k) * (1 - k));
    }
  }
  return STAGES[0].temp;
}

function stageAt(p: number): number {
  let idx = 0;
  STAGES.forEach((s, i) => {
    if (p >= s.at) idx = i;
  });
  return idx;
}

export function RoastStage() {
  const root = useRef<HTMLElement>(null);
  const beans = useRef<BeanCanvasHandle>(null);
  const tempRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const [stage, setStage] = useState(0);
  const stageRef = useRef(0);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const mm = gsap.matchMedia();

      const apply = (p: number) => {
        beans.current?.setRoast(p);
        if (tempRef.current) tempRef.current.textContent = String(Math.round(tempAt(p)));
        if (barRef.current) barRef.current.style.transform = `scaleX(${p.toFixed(4)})`;
        const s = stageAt(p);
        if (s !== stageRef.current) {
          stageRef.current = s;
          setStage(s);
        }
      };

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const st = ScrollTrigger.create({
          trigger: el,
          start: 'top top',
          end: 'bottom bottom',
          // scroll-linked: no easing curve — the scene eases on its own
          onUpdate: (self) => apply(self.progress),
        });
        // The heading arrives once, the first time the stage is reached.
        const intro = gsap.fromTo(
          el.querySelectorAll('[data-roast-intro]'),
          { autoAlpha: 0, y: 40 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 1,
            ease: 'power3.out',
            stagger: 0.08,
            scrollTrigger: { trigger: el, start: 'top 70%', once: true },
          },
        );
        return () => {
          st.kill();
          intro.scrollTrigger?.kill();
          intro.kill();
        };
      });

      // Reduced motion: no scrub. The stages are listed and the beans sit at
      // a finished roast.
      mm.add('(prefers-reduced-motion: reduce)', () => apply(0.8));

      return () => mm.revert();
    },
    { scope: root },
  );

  const current = STAGES[stage];

  return (
    <section ref={root} className="roast-stage" aria-labelledby="roast-stage-title">
      <div className="roast-stage__sticky">
        <BeanCanvas ref={beans} className="roast-stage__canvas" count={190} roast={0} />
        <div className="roast-stage__glow" aria-hidden="true" data-stage={stage} />

        <div className="shell roast-stage__copy">
          <p className="eyebrow" data-roast-intro>
            Seed to cup · scroll to roast
          </p>
          <h2 id="roast-stage-title" data-roast-intro>
            Twelve minutes,
            <br />
            two hundred degrees.
          </h2>

          <div className="roast-stage__readout" data-roast-intro>
            <div className="roast-stage__temp mono" aria-hidden="true">
              <span ref={tempRef}>25</span>
              <sup>°C</sup>
            </div>
            <div className="roast-stage__stage" key={stage}>
              <span className="roast-stage__step mono">
                {String(stage + 1).padStart(2, '0')} / {String(STAGES.length).padStart(2, '0')}
              </span>
              <strong>{current.name}</strong>
              <p className="muted">{current.note}</p>
            </div>
          </div>

          <div className="roast-stage__track" data-roast-intro aria-hidden="true">
            <span ref={barRef} className="roast-stage__bar" />
            {STAGES.map((s, i) => (
              <i
                key={s.name}
                className="roast-stage__tick"
                data-done={i <= stage || undefined}
                data-current={i === stage || undefined}
                style={{ left: `${s.at * 100}%` }}
              >
                <em>{s.name}</em>
              </i>
            ))}
          </div>

          {/* What a screen reader gets instead of the scrubbed readout. */}
          <ol className="sr-only">
            {STAGES.map((s) => (
              <li key={s.name}>
                {s.name}, about {s.temp}°C: {s.note}
              </li>
            ))}
          </ol>

          <div data-roast-intro>
            <Link href="/menu?category=beans" className="btn btn--outline">
              Taste the roast
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
