'use client';
/**
 * The roast curve, drawn by the scroll.
 *
 * It is a real chart: bean temperature against time, with the drying phase,
 * first crack and drop annotated where they actually fall. The line draws
 * under `--ease-scrub`, and each marker lights up as the line reaches it —
 * so the graph is explaining itself in the order a roaster would explain it.
 */
import { useState } from 'react';
import { DrawPath } from '@/components/motion/DrawPath';
import { Reveal } from '@/components/motion/Reveal';

const MARKERS = [
  { at: 0.16, x: 118, y: 214, label: 'Charge', detail: '210°C, beans in' },
  { at: 0.42, x: 300, y: 168, label: 'Drying', detail: 'Moisture off, grassy → bready' },
  { at: 0.68, x: 470, y: 104, label: 'First crack', detail: '196°C. The irreversible bit' },
  { at: 0.93, x: 622, y: 62, label: 'Drop', detail: '9:40. Development 21%' },
];

export function RoastCurve() {
  const [progress, setProgress] = useState(0);

  return (
    <div className="roast">
      <Reveal variant="rise" className="roast__intro">
        <p className="eyebrow">One irreversible minute</p>
        <h2>The curve is the recipe.</h2>
        <p className="lede">
          Green coffee is grassy and inedible. Nine minutes and forty seconds of falling rate-of-rise
          turns it into something you would pay for. Scroll it.
        </p>
      </Reveal>

      <DrawPath className="roast__chart" start="top 78%" end="bottom 62%" onProgress={setProgress}>
        <svg viewBox="0 0 700 260" role="img" aria-label="A roast profile: bean temperature rising from charge through drying and first crack to the drop at nine minutes forty.">
          <defs>
            <linearGradient id="roastFade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--terra-600)" />
              <stop offset="55%" stopColor="var(--aura-500)" />
              <stop offset="100%" stopColor="var(--aura-300)" />
            </linearGradient>
          </defs>

          {/* Grid — static, quiet, no animation. */}
          {[60, 110, 160, 210].map((y) => (
            <line key={y} x1="40" y1={y} x2="680" y2={y} stroke="var(--aura-300)" strokeWidth="0.5" opacity="0.1" />
          ))}
          <line x1="40" y1="238" x2="680" y2="238" stroke="var(--aura-300)" strokeWidth="0.6" opacity="0.22" />

          {/* The curve itself. */}
          <path
            data-draw
            d="M 60 226 C 120 220, 170 196, 224 176 S 336 142, 400 124 S 520 92, 580 74 S 650 56, 668 50"
            fill="none"
            stroke="url(#roastFade)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />

          {MARKERS.map((m) => {
            const on = progress >= m.at;
            return (
              <g key={m.label} opacity={on ? 1 : 0.28} style={{ transition: 'opacity var(--dur-md) var(--ease-aura)' }}>
                <line x1={m.x} y1={m.y} x2={m.x} y2="238" stroke="var(--aura-500)" strokeWidth="0.6" opacity="0.4" />
                <circle cx={m.x} cy={m.y} r={on ? 4.5 : 3} fill={on ? 'var(--aura-500)' : 'var(--roast-700)'} stroke="var(--aura-500)" strokeWidth="1.2" />
                <text x={m.x} y={m.y - 14} textAnchor="middle" className="roast__label">{m.label}</text>
              </g>
            );
          })}

          <text x="40" y="252" className="roast__axis">0:00</text>
          <text x="668" y="252" textAnchor="end" className="roast__axis">9:40</text>
          <text x="40" y="54" className="roast__axis">210°C</text>
        </svg>
      </DrawPath>

      <div className="roast__legend">
        {MARKERS.map((m) => (
          <div key={m.label} className="roast__legend-item" data-on={progress >= m.at || undefined}>
            <strong className="mono">{m.label}</strong>
            <span className="muted">{m.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
