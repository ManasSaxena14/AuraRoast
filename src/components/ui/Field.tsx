'use client';
import { useId, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface Common {
  label: string;
  error?: string | null;
  hint?: string;
  className?: string;
}

/** Focus draws a Halo arc beneath the field — the signature element doing
    real accessibility work (§1.3 #4). Errors carry a glyph, never colour alone. */
export function Field({
  label,
  error,
  hint,
  className,
  ...rest
}: Common & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className={`field${className ? ` ${className}` : ''}`} data-invalid={error ? 'true' : undefined}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        {...rest}
      />
      <span className="field__arc" aria-hidden="true" />
      {hint && !error ? (
        <span id={`${id}-hint`} className="field__hint muted">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-err`} className="field__error">
          <span aria-hidden="true">⚠</span>
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function SelectField({
  label,
  error,
  hint,
  className,
  children,
  ...rest
}: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div className={`field${className ? ` ${className}` : ''}`} data-invalid={error ? 'true' : undefined}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="select" aria-invalid={error ? true : undefined} {...rest}>
        {children}
      </select>
      <span className="field__arc" aria-hidden="true" />
      {hint && !error ? <span className="field__hint muted">{hint}</span> : null}
      {error ? (
        <span className="field__error">
          <span aria-hidden="true">⚠</span>
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function TextareaField({
  label,
  error,
  hint,
  className,
  ...rest
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div className={`field${className ? ` ${className}` : ''}`} data-invalid={error ? 'true' : undefined}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <textarea id={id} className="textarea" aria-invalid={error ? true : undefined} {...rest} />
      <span className="field__arc" aria-hidden="true" />
      {hint && !error ? <span className="field__hint muted">{hint}</span> : null}
      {error ? (
        <span className="field__error">
          <span aria-hidden="true">⚠</span>
          {error}
        </span>
      ) : null}
    </div>
  );
}
