'use client';
import Link from 'next/link';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

function classes(variant: Variant, size: Size, block?: boolean, className?: string) {
  return [
    'btn',
    `btn--${variant}`,
    size !== 'md' ? `btn--${size}` : '',
    block ? 'btn--block' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
}

/** Loading swaps the label for a 3-dot pulse AT THE SAME WIDTH — no shift. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'outline', size = 'md', block, loading, children, className, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={classes(variant, size, block, className)}
      data-loading={loading || undefined}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {children}
      {loading ? (
        <span className="btn__dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      ) : null}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = 'outline',
  size = 'md',
  block,
  children,
  className,
  prefetch = true,
  ...rest
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  children: React.ReactNode;
  className?: string;
  prefetch?: boolean;
} & Omit<React.ComponentProps<typeof Link>, 'href' | 'className' | 'prefetch'>) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={classes(variant, size, block, className)}
      {...rest}
    >
      {children}
    </Link>
  );
}
