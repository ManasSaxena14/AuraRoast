'use client';
/**
 * /menu (Blueprint §14.6).
 *
 *   · the category filter is held in URL state — a filtered view is a
 *     shareable link
 *   · the filter bar is sticky and shrinks past 120px of scroll
 *   · the grid uses ONE `ScrollTrigger.batch` for the whole set, not one
 *     trigger per card (§14.7 rule 6)
 *   · on filter change, existing cards leave under `--ease-settle` (120ms) and
 *     the new set enters under `--ease-aura` (240ms)
 */
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EASE, ScrollTrigger, gsap, useGSAP } from '@/components/motion/gsap';
import { CountUp } from '@/components/motion/CountUp';
import { DrinkCard } from '@/components/ui/DrinkCard';
import { EmptyState } from '@/components/ui/bits';
import { CATEGORIES } from '@/data/drinks';
import type { Drink } from '@/domain/types';

export function MenuBrowser({ drinks }: { drinks: Drink[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const category = params.get('category') ?? 'all';
  const query = params.get('q') ?? '';
  const [search, setSearch] = useState(query);
  const [shrunk, setShrunk] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return drinks.filter((d) => {
      if (category !== 'all' && d.category !== category) return false;
      if (!needle) return true;
      return `${d.name} ${d.description} ${d.tastingNotes.join(' ')}`.toLowerCase().includes(needle);
    });
  }, [drinks, category, search]);

  useEffect(() => {
    const onScroll = () => setShrunk(window.scrollY > 120);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const setCategory = useCallback(
    (slug: string) => {
      const next = new URLSearchParams(params.toString());
      if (slug === 'all') next.delete('category');
      else next.set('category', slug);
      router.replace(`/menu${next.size ? `?${next}` : ''}`, { scroll: false });
    },
    [params, router],
  );

  // Entry — one batch for the whole grid.
  useGSAP(
    () => {
      const grid = gridRef.current;
      if (!grid) return;
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const cards = Array.from(grid.children) as HTMLElement[];
        gsap.set(cards, { y: 24, opacity: 0 });
        const batch = ScrollTrigger.batch(cards, {
          start: 'top 85%',
          once: true,
          onEnter: (targets) =>
            gsap.to(targets, {
              y: 0,
              opacity: 1,
              duration: 0.6,
              ease: EASE.aura,
              stagger: { each: 0.04, amount: Math.min(targets.length * 0.04, 0.3) },
            }),
        });
        return () => {
          batch.forEach((t) => t.kill());
          gsap.set(cards, { clearProps: 'all' });
        };
      });

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(Array.from(grid.children), { y: 0, opacity: 1 });
      });

      return () => mm.revert();
    },
    // `revertOnUpdate` or nothing: without it @gsap/react adds a SECOND context
    // on every category change and never reverts the first, so each filter
    // leaves a live matchMedia and a batch of triggers holding removed cards.
    { scope: gridRef, dependencies: [category], revertOnUpdate: true },
  );

  // Filter change — out under --ease-settle, in under --ease-aura.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const grid = gridRef.current;
    if (!grid) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cards = Array.from(grid.children);
    gsap.fromTo(
      cards,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.24, ease: EASE.aura, stagger: 0.02, overwrite: true },
    );
    ScrollTrigger.refresh();
  }, [category, search]);

  return (
    <>
      <div className="menu-filter" data-shrunk={shrunk ? 'true' : 'false'}>
        <div className="menu-filter__chips">
          <button
            className="chip"
            aria-pressed={category === 'all'}
            onClick={() => setCategory('all')}
          >
            Everything
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.slug}
              className="chip"
              aria-pressed={category === c.slug}
              onClick={() => setCategory(c.slug)}
              title={c.blurb}
            >
              {c.label}
            </button>
          ))}
        </div>
        {/* Outside the scroller: a search field that has to be scrolled to is
            a search field nobody finds. */}
        <input
          className="input menu-search"
          type="search"
          value={search}
          placeholder="Search notes, names…"
          aria-label="Search the menu"
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Announced: with focus held in the search field, the count is the only
          signal that the query landed. The counting figure is hidden from the
          announcement and mirrored as text — a value that changes every frame
          would re-fire the live region every frame. */}
      <p
        className="mono muted"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{ fontSize: 'var(--text-xs)', margin: 'var(--space-4) 0' }}
      >
        <span aria-hidden="true">
          <CountUp value={visible.length} duration={0.6} grouped={false} />
        </span>
        <span className="sr-only">{visible.length}</span> of {drinks.length}
        {category !== 'all' ? ` · ${CATEGORIES.find((c) => c.slug === category)?.blurb}` : ''}
      </p>

      {visible.length === 0 ? (
        <EmptyState
          title="Nothing matches that."
          body="Try a tasting note instead — stone fruit, cocoa nib, cardamom. Or ask the barista."
          action={{ href: '/menu', label: 'Clear the filter' }}
        />
      ) : (
        <div className="grid-drinks" ref={gridRef} data-skew>
          {visible.map((d, i) => (
            <DrinkCard key={d.id} drink={d} priority={i < 3} />
          ))}
        </div>
      )}
    </>
  );
}
