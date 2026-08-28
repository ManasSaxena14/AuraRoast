'use client';
/**
 * Ambient steam (Blueprint §14.6 — Global).
 *
 * Cheap on the GPU, NOT rendered at all under reduced motion, and it yields
 * its frame budget whenever the hero scrub is actively painting (§16.3):
 * competing animations are budgeted, not merely allowed.
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

    let raf = 0;
    let running = true;
    const parts: Particle[] = [];
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);

    const size = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, rect.width * dpr);
      canvas.height = Math.max(1, rect.height * dpr);
    };
    size();

    const spawn = (): Particle => ({
      x: canvas.width * (0.2 + Math.random() * 0.6),
      y: canvas.height * (0.85 + Math.random() * 0.2),
      vx: (Math.random() - 0.5) * 0.18 * dpr,
      vy: -(0.25 + Math.random() * 0.4) * dpr,
      r: (18 + Math.random() * 46) * dpr,
      life: 0,
      maxLife: 260 + Math.random() * 320,
    });

    for (let i = 0; i < density; i++) {
      const p = spawn();
      p.life = Math.random() * p.maxLife;
      parts.push(p);
    }

    const frame = () => {
      if (!running) return;
      raf = requestAnimationFrame(frame);

      // Yield to the hero scrub — it owns the frame while it is painting.
      if (document.documentElement.dataset.scrubbing === 'true') return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter';

      for (const p of parts) {
        p.life += 1;
        if (p.life > p.maxLife) Object.assign(p, spawn());
        p.x += p.vx + Math.sin(p.life / 46) * 0.22 * dpr;
        p.y += p.vy;

        const t = p.life / p.maxLife;
        const alpha = Math.sin(t * Math.PI) * 0.055;
        if (alpha <= 0.001) continue;

        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(242, 206, 147, ${alpha})`);
        g.addColorStop(1, 'rgba(242, 206, 147, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    // Nothing renders while the section is off screen.
    const io = new IntersectionObserver(
      ([entry]) => {
        running = entry.isIntersecting;
        if (running && !raf) raf = requestAnimationFrame(frame);
        if (!running && raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    window.addEventListener('resize', size);
    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      io.disconnect();
      window.removeEventListener('resize', size);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [density]);

  return <canvas ref={ref} className={`steam-canvas${className ? ` ${className}` : ''}`} aria-hidden="true" />;
}
