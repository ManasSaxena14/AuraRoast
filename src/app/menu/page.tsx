import { Suspense } from 'react';
import type { Metadata } from 'next';
import { listDrinks } from '@/repositories';
import { Reveal } from '@/components/motion/Reveal';
import { MenuBrowser } from '@/components/menu/MenuBrowser';
import { DrinkCardSkeleton } from '@/components/ui/DrinkCard';

export const metadata: Metadata = {
  title: 'Menu',
  description: 'Sixteen ways to drink five origins. Every one names where it came from.',
};

export default async function MenuPage() {
  const drinks = await listDrinks();

  return (
    <div className="shell">
      <header className="page-head">
        <Reveal variant="fade">
          <p className="eyebrow">On the bar today</p>
        </Reveal>
        <h1>Sixteen ways to drink five hillsides.</h1>
        <Reveal variant="rise" delay={0.06}>
          <p className="lede">
            Espresso, filter, milk, cold, and whole bean. Prices are what you pay — tax is shown
            separately at checkout and nothing is added afterwards.
          </p>
        </Reveal>
      </header>

      <Suspense
        fallback={
          <div className="grid-drinks">
            {Array.from({ length: 8 }).map((_, i) => (
              <DrinkCardSkeleton key={i} />
            ))}
          </div>
        }
      >
        <MenuBrowser drinks={drinks} />
      </Suspense>
      <div style={{ height: 'var(--space-10)' }} />
    </div>
  );
}
