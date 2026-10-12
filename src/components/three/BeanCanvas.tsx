'use client';
/**
 * Mounts the bean field. three.js (~150 KB gzipped) is imported only when
 * the canvas is about to be seen, so nothing above the fold pays for it.
 *
 * The parent drives it through the handle — `setRoast(0…1)` — never through
 * props, so scrolling never re-renders React.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { BeanScene, BeanSceneOptions } from './beanScene';

export interface BeanCanvasHandle {
  setRoast: (value: number) => void;
}

export const BeanCanvas = forwardRef<BeanCanvasHandle, BeanSceneOptions & { className?: string }>(
  function BeanCanvas({ className, count, roast, drift, sparks, offsetX }, ref) {
    const host = useRef<HTMLDivElement>(null);
    const scene = useRef<BeanScene | null>(null);
    const pending = useRef<number | null>(null);

    useImperativeHandle(ref, () => ({
      setRoast(value: number) {
        if (scene.current) scene.current.setRoast(value);
        else pending.current = value; // arrives before the module has loaded
      },
    }));

    useEffect(() => {
      const el = host.current;
      if (!el) return;
      let cancelled = false;
      let io: IntersectionObserver | null = null;

      const boot = async () => {
        io?.disconnect();
        let mod: typeof import('./beanScene');
        try {
          mod = await import('./beanScene');
        } catch {
          return; // a failed chunk leaves the static backdrop — never an error
        }
        if (cancelled) return;
        try {
          scene.current = new mod.BeanScene(el, { count, roast, drift, sparks, offsetX });
          if (pending.current !== null) scene.current.setRoast(pending.current);
          el.dataset.ready = 'true';
        } catch {
          /* no WebGL: the CSS backdrop behind the canvas stays as it is */
        }
      };

      // Already within a screen of the viewport (the sign-in backdrop): boot
      // now rather than waiting a frame for the observer. Otherwise load a
      // screen ahead of arrival, not on page load.
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 2 && r.bottom > -window.innerHeight) {
        void boot();
      } else {
        io = new IntersectionObserver(([e]) => e.isIntersecting && void boot(), { rootMargin: '100% 0px' });
        io.observe(el);
      }

      return () => {
        cancelled = true;
        io?.disconnect();
        scene.current?.dispose();
        scene.current = null;
      };
      // Options are read once, at boot.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <div ref={host} className={`bean-canvas${className ? ` ${className}` : ''}`} />;
  },
);
