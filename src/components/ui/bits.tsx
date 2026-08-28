import Link from 'next/link';
import { Halo } from '@/components/motion/Halo';

/** The loading state. There are no spinners in this build (Part 15). */
export function Skeleton({
  height = 20,
  width,
  radius,
  className,
}: {
  height?: number | string;
  width?: number | string;
  radius?: number;
  className?: string;
}) {
  return (
    <div
      className={`skeleton${className ? ` ${className}` : ''}`}
      style={{ height, width, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

/** Empty states are designed, not defaulted: a Halo, one line, one action. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="empty">
      <Halo size={72} stroke={1.5} progress={0.62} />
      <h3>{title}</h3>
      <p className="muted" style={{ maxWidth: '38ch' }}>
        {body}
      </p>
      {action ? (
        <Link href={action.href} className="btn btn--outline btn--sm">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function Rating({ value, count }: { value: number; count?: number }) {
  const rounded = Math.round(value);
  return (
    <span className="row" style={{ gap: 'var(--space-2)' }}>
      <span className="rating" role="img" aria-label={`${value.toFixed(1)} out of 5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <svg key={i} viewBox="0 0 24 24" data-off={i > rounded || undefined} aria-hidden="true">
            <path
              d="M12 2.6l2.6 6.1 6.6.5-5 4.3 1.5 6.5L12 16.5 6.3 20l1.5-6.5-5-4.3 6.6-.5z"
              fill="currentColor"
            />
          </svg>
        ))}
      </span>
      {count !== undefined ? (
        <span className="mono muted" style={{ fontSize: 'var(--text-xs)' }}>
          {value.toFixed(1)} · {count}
        </span>
      ) : null}
    </span>
  );
}

export function IntensityMeter({ value }: { value: number }) {
  return (
    <span className="intensity" role="img" aria-label={`Intensity ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} data-on={i <= value || undefined} />
      ))}
    </span>
  );
}

export function Badge({
  children,
  tone = 'muted',
}: {
  children: React.ReactNode;
  tone?: 'muted' | 'aura' | 'seasonal' | 'origin';
}) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 20,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Fewer ${label}`}>
        −
      </button>
      <span aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`More ${label}`}>
        +
      </button>
    </div>
  );
}

export function SectionHead({
  eyebrow,
  title,
  lede,
  action,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="section-head">
      <div className="stack-sm">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {lede ? <p className="lede">{lede}</p> : null}
      </div>
      {action ? (
        <Link href={action.href} className="link-arrow">
          {action.label}
          <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    </div>
  );
}
