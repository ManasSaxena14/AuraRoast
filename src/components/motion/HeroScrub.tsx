'use client';
/**
 * The scroll-scrubbed hero (Blueprint §14.4).
 *
 * The brand made literal: green bean → toast → grind → bloom → pour → the
 * Halo closing. The *toast* beat is the longest and best-lit segment — it is
 * the product name happening on screen.
 *
 * Engineering rules:
 *   · frames decode via `createImageBitmap` (off the main thread) and paint
 *     STRAIGHT to canvas — never 144 <img> tags, never a setState per tick
 *   · only a WINDOW of frames is decoded at once. All 144 compressed frames are
 *     kept (≈4 MB), but a decoded 1280×720 frame is 3.7 MB, and holding every
 *     one was ≈530 MB of memory for a single tab — enough to make the whole
 *     page stutter. Frames around the scroll position are decoded ahead of it
 *     in the direction of travel; the farthest ones are released.
 *   · the canvas backing store is never larger than the source frames can
 *     fill. On a retina screen it used to be 2880×1800 filled from a 1280×720
 *     frame — four times the pixels per scroll frame for identical output.
 *   · the canvas never shows empty: the nearest decoded frame stands in until
 *     the exact one arrives
 *   · only the coarse loading percentage during the intro gate is React state
 *   · the primary CTA is keyboard-reachable before the scrub finishes — a pin
 *     must never trap a keyboard user inside a decorative sequence (§17.4)
 */
import { useEffect, useRef, useState } from 'react';
import { ScrollTrigger, gsap, useGSAP } from './gsap';

interface Sequence {
  count: number;
  width: number;
  height: number;
  dir: 'desktop' | 'mobile';
  /** Decoded frames held at once. */
  cache: number;
}

const DESKTOP: Sequence = { count: 144, width: 1280, height: 720, dir: 'desktop', cache: 32 };
const MOBILE: Sequence = { count: 72, width: 720, height: 405, dir: 'mobile', cache: 72 };
const MOBILE_BREAKPOINT = 640; // ONE source of truth for "is this a small screen"

/** Frames decoded before the gate lifts. */
const PRIME_COUNT = 12;
/** On a slow connection the gate lifts anyway: the copy and CTAs beneath it
    matter more than the first frames of a decorative sequence. */
const GATE_TIMEOUT_MS = 4500;
const FETCH_CONCURRENCY = 6;
/** Parallel decodes: enough to stay ahead of a fast scroll, few enough that
    decoding never competes with the scroll itself. */
const DECODE_CONCURRENCY = 3;
const AHEAD = 18;
const BEHIND = 6;

type Frame = ImageBitmap | HTMLImageElement;

function release(frame: Frame) {
  if ('close' in frame) frame.close();
}

async function decodeBlob(blob: Blob): Promise<Frame> {
  if ('createImageBitmap' in window) return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function framePath(seq: Sequence, index: number) {
  return `/hero/${seq.dir}/${String(index + 1).padStart(3, '0')}.webp`;
}

export interface HeroScrubProps {
  children?: React.ReactNode;
  /** Rendered above the canvas, outside the scrub's paint path. */
  overlay?: React.ReactNode;
}

export function HeroScrub({ overlay }: HeroScrubProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handoffRef = useRef<HTMLDivElement>(null);
  /** Set by the engine once it exists; the scrub calls it with a 0–1 progress. */
  const seekRef = useRef<(progress: number) => void>(() => {});
  /** The scrub can report before the engine exists (a reload mid-hero); the
      engine starts from the last position it was told about. */
  const progressRef = useRef(0);

  // The ONLY React state in the scrub engine.
  const [loaded, setLoaded] = useState(0);
  const [ready, setReady] = useState(false);

  /* ── The engine: fetch, windowed decode, paint ────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const seq = window.innerWidth < MOBILE_BREAKPOINT ? MOBILE : DESKTOP;
    const toIndex = (progress: number) =>
      Math.max(0, Math.min(seq.count - 1, Math.round(progress * (seq.count - 1))));
    const blobs: (Blob | null)[] = new Array(seq.count).fill(null);
    const bitmaps = new Map<number, Frame>();
    const decoding = new Set<number>();
    const aborter = new AbortController();
    let disposed = false;
    // Usually 0 — but a reload halfway down the hero starts halfway through.
    let want = toIndex(progressRef.current);
    let dir: 1 | -1 = 1;
    let painted = -1;
    let sized = false;
    let gateOpen = false;

    /** Nearest-first around a frame, leaning in the direction of travel. */
    const around = (center: number, ahead: number, behind: number): number[] => {
      const out = [center];
      for (let k = 1; k <= Math.max(ahead, behind); k++) {
        if (k <= ahead) out.push(center + dir * k);
        if (k <= behind) out.push(center - dir * k);
      }
      return out.filter((i) => i >= 0 && i < seq.count);
    };

    // What arrives first, and what the gate waits for, is the neighbourhood
    // the guest is actually looking at.
    const fetchOrder = around(want, seq.count, seq.count);
    const primeTargets = new Set(fetchOrder.slice(0, PRIME_COUNT));

    const nearestDecoded = (i: number): number => {
      if (bitmaps.has(i)) return i;
      for (let d = 1; d < seq.count; d++) {
        if (bitmaps.has(i - d * dir)) return i - d * dir;
        if (bitmaps.has(i + d * dir)) return i + d * dir;
      }
      return -1;
    };

    const paint = (force = false) => {
      if (!sized) return;
      const i = nearestDecoded(want);
      if (i < 0 || (i === painted && !force)) return;
      const frame = bitmaps.get(i);
      if (!frame) return;
      painted = i;
      const cw = canvas.width;
      const ch = canvas.height;
      // object-fit: cover, computed here so the canvas never letterboxes.
      const scale = Math.max(cw / seq.width, ch / seq.height);
      const w = seq.width * scale;
      const h = seq.height * scale;
      ctx.drawImage(frame, (cw - w) / 2, (ch - h) / 2, w, h);
    };

    /* ── Sizing — must happen before the first paint ────────────────── */
    const size = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      let w = rect.width * dpr;
      let h = rect.height * dpr;
      // Past the source's own resolution extra canvas pixels are only
      // interpolation — let the compositor do that scale for free.
      const cover = Math.max(w / seq.width, h / seq.height);
      if (cover > 1) {
        w /= cover;
        h /= cover;
      }
      w = Math.round(w);
      h = Math.round(h);
      sized = true;
      if (canvas.width === w && canvas.height === h) return;
      // Resizing clears the backing store, so the held frame is repainted.
      canvas.width = w;
      canvas.height = h;
      paint(true);
    };

    /* ── Decode window ──────────────────────────────────────────────── */
    const evict = () => {
      while (bitmaps.size > seq.cache) {
        let worst = -1;
        let worstScore = -1;
        for (const i of bitmaps.keys()) {
          // Frames behind the direction of travel go first.
          const ahead = (i - want) * dir;
          const score = ahead >= 0 ? ahead : -ahead * 3;
          if (score > worstScore) {
            worstScore = score;
            worst = i;
          }
        }
        if (worst < 0) return;
        const frame = bitmaps.get(worst);
        bitmaps.delete(worst);
        if (frame) release(frame);
      }
    };

    const nextToDecode = (): number => {
      for (const i of around(want, AHEAD, BEHIND)) {
        if (blobs[i] && !bitmaps.has(i) && !decoding.has(i)) return i;
      }
      return -1;
    };

    // A prime frame is settled when it decoded OR definitively failed — a
    // missing frame must never hold the gate shut.
    const primeSettled = new Set<number>();
    const openGate = () => {
      if (gateOpen || disposed) return;
      gateOpen = true;
      paint(true);
      setReady(true);
    };
    const settlePrime = (i: number) => {
      if (gateOpen || !primeTargets.has(i)) return;
      primeSettled.add(i);
      setLoaded(Math.round((primeSettled.size / primeTargets.size) * 100));
      if (primeSettled.size === primeTargets.size) openGate();
    };
    const gateTimer = setTimeout(openGate, GATE_TIMEOUT_MS);

    const pump = () => {
      while (!disposed && decoding.size < DECODE_CONCURRENCY) {
        const i = nextToDecode();
        if (i < 0) return;
        const blob = blobs[i]!;
        decoding.add(i);
        decodeBlob(blob)
          .then((frame) => {
            decoding.delete(i);
            if (disposed) return release(frame);
            bitmaps.set(i, frame);
            evict();
            // Repaint only if this frame is closer to where the scroll is
            // than the one on screen.
            if (painted < 0 || Math.abs(i - want) < Math.abs(painted - want)) paint();
            settlePrime(i);
            pump();
          })
          .catch(() => {
            // One frame that will not decode is not worth failing the hero;
            // its neighbours stand in for it.
            decoding.delete(i);
            blobs[i] = null;
            settlePrime(i);
            pump();
          });
      }
    };

    /* ── Fetch every compressed frame, nearest first, a few at a time ── */
    let nextFetch = 0;
    const fetchNext = async (): Promise<void> => {
      while (!disposed && nextFetch < fetchOrder.length) {
        const i = fetchOrder[nextFetch++];
        try {
          const res = await fetch(framePath(seq, i), { signal: aborter.signal });
          if (res.ok) blobs[i] = await res.blob();
        } catch {
          if (disposed) return;
        }
        if (disposed) return;
        if (!blobs[i]) settlePrime(i); // fetch failed: settled, as a miss
        pump();
      }
    };

    seekRef.current = (progress: number) => {
      const next = toIndex(progress);
      if (next === want) return;
      dir = next > want ? 1 : -1;
      want = next;
      paint();
      pump();
    };

    size();
    for (let k = 0; k < FETCH_CONCURRENCY; k++) void fetchNext();

    const ro = new ResizeObserver(size);
    ro.observe(canvas);

    return () => {
      disposed = true;
      clearTimeout(gateTimer);
      aborter.abort();
      ro.disconnect();
      seekRef.current = () => {};
      for (const frame of bitmaps.values()) release(frame);
      bitmaps.clear();
    };
  }, []);

  /* ── The scrub ────────────────────────────────────────────────────── */
  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;
      const handoff = handoffRef.current;

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
            // Frames go STRAIGHT to canvas — never through React state. A
            // setState per scroll tick is a dropped-frame machine.
            progressRef.current = self.progress;
            seekRef.current(self.progress);
            // The canvas fades to --roast-950 as the pin releases. Written as
            // opacity on the one element, not as an inherited custom property
            // that re-styles the whole hero subtree every frame.
            if (handoff) {
              handoff.style.opacity = String(Math.min(1, Math.max(0, (self.progress - 0.86) * 7.1)));
            }
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
          delete document.documentElement.dataset.scrubbing;
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
          onUpdate: (self) => {
            progressRef.current = self.progress;
            seekRef.current(self.progress);
          },
        });
        return () => st.kill();
      });

      return () => mm.revert();
    },
    { scope: sectionRef },
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
        <div ref={handoffRef} className="hero__handoff" aria-hidden="true" />
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
