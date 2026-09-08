'use client';
/**
 * The 240-frame scroll-scrubbed hero (Blueprint §14.4).
 *
 * The brand made literal: green bean → toast → grind → bloom → pour → the
 * Halo closing. The *toast* beat is the longest and best-lit segment — it is
 * the product name happening on screen.
 *
 * Engineering rules, carried forward verbatim because they are correct:
 *   · frames decode via `createImageBitmap` and paint STRAIGHT to canvas —
 *     never 240 <img> tags, never a setState per scroll tick
 *   · the engine waits for real canvas sizing before mounting; sizing too
 *     early paints into the default backing store and stretches frame one
 *   · only the coarse loading percentage during the intro gate is React state
 *   · the primary CTA is keyboard-reachable before the scrub finishes — a pin
 *     must never trap a keyboard user inside a decorative sequence (§17.4)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollTrigger, gsap, prefersReducedMotion, useGSAP } from './gsap';

const DESKTOP_FRAMES = 144;
const MOBILE_FRAMES = 72;
const MOBILE_BREAKPOINT = 640; // ONE source of truth for "is this a small screen"

/** Frames decoded before the gate lifts. The rest stream in behind the scroll. */
const PRIME_COUNT = 16;
/** Parallel decodes for the streaming tail. High enough to stay ahead of a
    fast scroll, low enough that decoding never starves the scroll itself. */
const STREAM_CONCURRENCY = 8;

function framePath(index: number, mobile: boolean) {
  const n = String(index + 1).padStart(3, '0');
  return mobile ? `/hero/mobile/${n}.webp` : `/hero/desktop/${n}.webp`;
}

export interface HeroScrubProps {
  children?: React.ReactNode;
  /** Rendered above the canvas, outside the scrub's paint path. */
  overlay?: React.ReactNode;
}

export function HeroScrub({ overlay }: HeroScrubProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frames = useRef<(ImageBitmap | HTMLImageElement | null)[]>([]);
  const frameCount = useRef(DESKTOP_FRAMES);
  const isMobile = useRef(false);
  const current = useRef(-1);
  const painted = useRef(-1);
  const sized = useRef(false);
  const dpr = useRef(1);

  // The ONLY React state in the scrub engine.
  const [loaded, setLoaded] = useState(0);
  const [ready, setReady] = useState(false);

  /* ── Painting ─────────────────────────────────────────────────────── */
  /**
   * The nearest ALREADY-DECODED frame to `i`. While the tail is still
   * streaming, a fast scroll will land on a frame that has not arrived — and
   * the one thing the hero must never do is show an empty canvas. Holding the
   * previous frame is not enough either: a resize clears the backing store, so
   * "hold" can mean "hold nothing".
   */
  const nearestDecoded = useCallback((i: number): number => {
    const total = frameCount.current;
    if (frames.current[i]) return i;
    for (let d = 1; d < total; d++) {
      if (i - d >= 0 && frames.current[i - d]) return i - d;
      if (i + d < total && frames.current[i + d]) return i + d;
    }
    return -1;
  }, []);

  const paint = useCallback(
    (index: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !sized.current) return;

      const wanted = Math.max(0, Math.min(frameCount.current - 1, index));
      current.current = wanted;

      const i = nearestDecoded(wanted);
      if (i < 0) return; // nothing decoded at all yet — the gate is still up
      if (i === painted.current) return;

      const bmp = frames.current[i];
      if (!bmp) return;
      painted.current = i;

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      const cw = canvas.width;
      const ch = canvas.height;
      const iw = 'width' in bmp ? bmp.width : 1280;
      const ih = 'height' in bmp ? bmp.height : 720;

      // object-fit: cover, computed here so the canvas never letterboxes.
      const scale = Math.max(cw / iw, ch / ih);
      const w = iw * scale;
      const h = ih * scale;
      ctx.drawImage(bmp as CanvasImageSource, (cw - w) / 2, (ch - h) / 2, w, h);
    },
    [nearestDecoded],
  );

  /* ── Sizing — must happen before the first paint ──────────────────── */
  const size = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    dpr.current = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * dpr.current);
    canvas.height = Math.round(rect.height * dpr.current);
    sized.current = true;
    // Resizing clears the backing store, so the held frame must be repainted.
    painted.current = -1;
    paint(current.current < 0 ? 0 : current.current);
  }, [paint]);

  /* ── Decode ───────────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    const mobile = window.innerWidth < MOBILE_BREAKPOINT;
    isMobile.current = mobile;
    frameCount.current = mobile ? MOBILE_FRAMES : DESKTOP_FRAMES;
    frames.current = new Array(frameCount.current).fill(null);

    const decode = async (i: number) => {
      try {
        const res = await fetch(framePath(i, mobile));
        if (!res.ok) return;
        const blob = await res.blob();
        if (cancelled) return;
        // createImageBitmap decodes off the main thread.
        const bmp = 'createImageBitmap' in window
          ? await createImageBitmap(blob)
          : await legacyDecode(blob);
        // Re-checked AFTER the decode: the cleanup below only closes what was
        // in `frames.current` when it ran, so a bitmap that lands later would
        // be written into an array nothing iterates again and never freed.
        if (cancelled) {
          if ('close' in bmp) bmp.close();
          return;
        }
        frames.current[i] = bmp;
      } catch {
        /* one missing frame is not worth failing the hero for */
      }
    };

    (async () => {
      size();
      // Prime the opening beats so the gate lifts fast, then stream the rest.
      const first = Array.from({ length: PRIME_COUNT }, (_, i) => i);
      let done = 0;
      await Promise.all(
        first.map(async (i) => {
          await decode(i);
          done++;
          if (!cancelled) setLoaded(Math.round((done / PRIME_COUNT) * 100));
        }),
      );
      if (cancelled) return;
      painted.current = -1;
      paint(0);
      setReady(true);

      // The remainder, streamed in batches, repainting after each batch so a
      // guest who is already scrolling sees the sequence sharpen up rather
      // than sitting on one held frame.
      const rest = Array.from(
        { length: frameCount.current - PRIME_COUNT },
        (_, i) => i + PRIME_COUNT,
      );
      for (let i = 0; i < rest.length; i += STREAM_CONCURRENCY) {
        if (cancelled) return;
        await Promise.all(rest.slice(i, i + STREAM_CONCURRENCY).map(decode));
        painted.current = -1;
        paint(current.current < 0 ? 0 : current.current);
      }
      // Trigger heights are only correct once the media has settled.
      ScrollTrigger.refresh();
    })();

    return () => {
      cancelled = true;
      for (const f of frames.current) {
        if (f && 'close' in f) f.close();
      }
      frames.current = [];
    };
  }, [paint, size]);

  /* ── Resize ───────────────────────────────────────────────────────── */
  useEffect(() => {
    const onResize = () => size();
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(onResize);
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => {
      window.removeEventListener('resize', onResize);
      ro.disconnect();
    };
  }, [size]);

  /* ── The scrub ────────────────────────────────────────────────────── */
  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const st = ScrollTrigger.create({
          trigger: section,
          start: 'top top',
          end: '+=200%', // long enough to read, short enough not to trap
          pin: true,
          pinSpacing: true,
          scrub: 0.6, // slight lag = weight, not sloppiness
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            // Frame decoding writes STRAIGHT to canvas — never through React
            // state. A setState per scroll tick is a dropped-frame machine.
            paint(Math.round(self.progress * (frameCount.current - 1)));
            section.style.setProperty('--hero-progress', String(self.progress));
          },
          onToggle: (self) => {
            // The ambient steam yields its frame budget while the scrub is
            // actively painting (§16.3).
            document.documentElement.dataset.scrubbing = self.isActive ? 'true' : 'false';
          },
        });

        // The copy layer lifts away as the pin releases.
        const copy = section.querySelector('[data-hero-copy]');
        const tl = copy
          ? gsap.to(copy, {
              opacity: 0,
              y: -40,
              ease: 'none',
              scrollTrigger: {
                trigger: section,
                start: 'top top+=40%',
                end: '+=120%',
                scrub: true,
              },
            })
          : null;

        return () => {
          st.kill();
          tl?.scrollTrigger?.kill();
          tl?.kill();
        };
      });

      // Reduced motion keeps the scrub — it is scroll-LINKED, not autonomous
      // motion — but drops the copy parallax. Pinning stays (§17.2).
      mm.add('(prefers-reduced-motion: reduce)', () => {
        const st = ScrollTrigger.create({
          trigger: section,
          start: 'top top',
          end: '+=160%',
          pin: true,
          scrub: false,
          invalidateOnRefresh: true,
          onUpdate: (self) => paint(Math.round(self.progress * (frameCount.current - 1))),
        });
        return () => st.kill();
      });

      return () => mm.revert();
    },
    { scope: sectionRef, dependencies: [paint], revertOnUpdate: true },
  );

  return (
    /* `pin-host` is load-bearing, not decoration. ScrollTrigger's `pin` moves
       this <section> into a `.pin-spacer` it injects into the section's PARENT.
       Without this wrapper that parent is `.page-root`, whose child list React
       also owns — so the moment React inserts or removes any sibling there it
       calls insertBefore against a node that is no longer its child and throws
       NotFoundError, killing the whole page subtree. Giving GSAP a host element
       React never adds siblings to keeps the two owners off each other's turf. */
    <div className="pin-host">
      <section ref={sectionRef} className="hero" aria-label="Bean to cup">
        <canvas ref={canvasRef} className="hero__canvas" aria-hidden="true" />
        <div className="hero__vignette" aria-hidden="true" />
        {/* The canvas fades to --roast-950 as the pin releases, so the hero
            hands off to the content beneath it rather than cutting (§14.6). */}
        <div className="hero__handoff" aria-hidden="true" />
        {overlay}
        {!ready && (
          <div className="hero__gate" aria-hidden="true">
            <div className="hero__gate-bar">
              <span style={{ transform: `scaleX(${loaded / 100})` }} />
            </div>
            <p className="mono hero__gate-pct">{loaded}%</p>
          </div>
        )}
        {/* The full sequence, described once, for anyone who cannot see it. */}
        <p className="sr-only">
          A macro sequence: green coffee seeds, the roast turning them brown, the grind, the
          bloom as water hits fresh grounds, the pour, and finally a finished cup resting in
          morning light.
        </p>
      </section>
    </div>
  );
}

async function legacyDecode(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  await img.decode();
  URL.revokeObjectURL(url);
  return img;
}
