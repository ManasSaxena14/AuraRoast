'use client';
/**
 * The single place GSAP is configured. Importing ScrollTrigger anywhere else
 * risks a second registration and a second set of triggers.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

let registered = false;

if (typeof window !== 'undefined' && !registered) {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
  // Mobile browsers fire resize on every URL-bar show/hide, which would
  // otherwise refresh every trigger mid-scroll (§14.7 rule 3).
  ScrollTrigger.config({ limitCallbacks: true, ignoreMobileResize: true });
  registered = true;
}

/** The GSAP names for the four easing tokens in §12.5. */
export const EASE = {
  aura: 'power3.out',
  bloom: 'back.out(1.7)',
  settle: 'power3.in',
  scrub: 'none',
} as const;

export const DUR = {
  micro: 0.12,
  sm: 0.2,
  md: 0.32,
  lg: 0.48,
  xl: 0.8,
} as const;

export const MOBILE_QUERY = '(max-width: 639px)';

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export { gsap, ScrollTrigger, useGSAP };
