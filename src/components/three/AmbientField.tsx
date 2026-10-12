'use client';
/**
 * The bean field behind the top of every inner page.
 *
 * Mounted ONCE in the root layout, outside the page transition, so it keeps
 * one WebGL context for the whole visit. A navigation does not tear it down —
 * it RE-ROASTS: each route has its own roast, and the beans ease from the
 * last page's colour to this one's. That colour change is the page opening.
 *
 * Off on the routes where moving things behind the content would cost more
 * than they give: the home page (its own stage), sign-in (its own backdrop),
 * checkout (a form — nothing moves), the two map pages, and the back office.
 */
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { BeanCanvas, type BeanCanvasHandle } from './BeanCanvas';

const OFF = [/^\/$/, /^\/login/, /^\/checkout/, /^\/origins/, /^\/track\/./, /^\/admin/, /^\/locations/];

/** Roast per section — light and green where the story is the farm, dark where it is the cup. */
const ROAST: [RegExp, number][] = [
  [/^\/about/, 0.22],
  [/^\/guides/, 0.45],
  [/^\/reservations/, 0.6],
  [/^\/stores/, 0.55],
  [/^\/menu\/./, 0.78],
  [/^\/menu/, 0.7],
  [/^\/pairings/, 0.92],
  [/^\/account/, 0.66],
  [/^\/track/, 0.5],
];

function roastFor(path: string): number {
  return ROAST.find(([re]) => re.test(path))?.[1] ?? 0.65;
}

export function AmbientField() {
  const pathname = usePathname();
  const off = OFF.some((re) => re.test(pathname));
  const beans = useRef<BeanCanvasHandle>(null);
  // Never mounted until the first inner page — the home page never pays.
  const [armed, setArmed] = useState(!off);

  useEffect(() => {
    if (!off) setArmed(true);
    beans.current?.setRoast(roastFor(pathname));
  }, [pathname, off]);

  if (!armed) return null;
  return (
    <div className="ambient" data-off={off || undefined} aria-hidden="true">
      <BeanCanvas ref={beans} count={70} roast={roastFor(pathname)} drift={0.45} offsetX={4.2} sparks={false} />
    </div>
  );
}
