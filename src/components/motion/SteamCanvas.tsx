'use client';
/**
 * Ambient steam (Blueprint §14.6 — Global).
 *
 * Cheap on purpose, NOT rendered at all under reduced motion, and it yields
 * its frame budget whenever the hero scrub is actively painting (§16.3):
 * competing animations are budgeted, not merely allowed.
 *
 * What makes it cheap:
 *   · ONE soft radial sprite is rendered once to an offscreen canvas; every
 *     particle is a `drawImage` of it. Building a fresh radial gradient per
 *     particle per frame was the whole cost of the old version.
 *   · the backing store is half the element's size — steam is a blur, and the
 *     browser's upscale is free — so each frame fills a quarter of the pixels
 *   · nothing draws while the canvas is off screen or the tab is hidden
 */
import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from './gsap';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
}

/** Backing-store scale relative to CSS pixels. */
const RESOLUTION = 0.5;
const SPRITE = 128;

function makeSprite(): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = SPRITE;
  const ctx = sprite.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
    // The same falloff each particle's own gradient used to have.
    g.addColorStop(0, 'rgba(242, 206, 147, 1)');
    g.addColorStop(1, 'rgba(242, 206, 147, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SPRITE, SPRITE);
  }
  return sprite;
}

export function SteamCanvas({
  density = 22,
  className,
}: {
  density?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sprite = makeSprite();
    let raf = 0;
    let visible = false;
    let last = 0;
    const parts: Particle[] = [];

    const size = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * RESOLUTION));
      canvas.height = Math.max(1, Math.round(rect.height * RESOLUTION));
    };
    size();

    const spawn = (): Particle => ({
      x: canvas.width * (0.2 + Math.random() * 0.6),
      y: canvas.height * (0.85 + Math.random() * 0.2),
      vx: (Math.random() - 0.5) * 0.18 * RESOLUTION,
      vy: -(0.25 + Math.random() * 0.4) * RESOLUTION,
      r: (18 + Math.random() * 46) * RESOLUTION,
      life: 0,
      maxLife: 260 + Math.random() * 320,
    });

    for (let i = 0; i < density; i++) {
      const p = spawn();
      p.life = Math.random() * p.maxLife;
      parts.push(p);
    }

    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      raf = requestAnimationFrame(frame);

      // Yield to the hero scrub — it owns the frame while it is painting.
      if (document.documentElement.dataset.scrubbing === 'true') return;

      // Particle speeds are tuned per 60 Hz frame; a 120 Hz display advances
      // them by elapsed time rather than twice as fast.
      const step = last ? Math.min(3, (now - last) / 16.67) : 1;
      last = now;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter';

      for (const p of parts) {
        p.life += step;
        if (p.life > p.maxLife) Object.assign(p, spawn());
        p.x += (p.vx + Math.sin(p.life / 46) * 0.22 * RESOLUTION) * step;
        p.y += p.vy * step;

        const alpha = Math.sin((p.life / p.maxLife) * Math.PI) * 0.055;
        if (alpha <= 0.001) continue;
        ctx.globalAlpha = alpha;
        ctx.drawImage(sprite, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }
      ctx.globalAlpha = 1;
    };

    const start = () => {
      if (!raf && visible && !document.hidden) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    // Nothing renders while the section is off screen or the tab is hidden.
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) start();
        else stop();
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);

    const ro = new ResizeObserver(size);
    ro.observe(canvas);

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [density]);

  return <canvas ref={ref} className={`steam-canvas${className ? ` ${className}` : ''}`} aria-hidden="true" />;
}
