import { DrinkCardSkeleton } from '@/components/ui/DrinkCard';
import { Skeleton } from '@/components/ui/bits';

/** The skeleton occupies the exact final layout box (§13.6 rule 3, §16.2). */
export default function Loading() {
  return (
    <div className="shell">
      <header className="page-head">
        <Skeleton height={14} width={180} />
        <Skeleton height={56} width="70%" />
        <Skeleton height={20} width="45%" />
      </header>
      <div className="menu-filter">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={36} width={92} radius={999} />
        ))}
      </div>
      <div className="grid-drinks" style={{ marginTop: 'var(--space-6)' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <DrinkCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
