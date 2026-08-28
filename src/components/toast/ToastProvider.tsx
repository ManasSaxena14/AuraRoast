'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export type ToastKind = 'default' | 'success' | 'error';
interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
  leaving?: boolean;
}

const ToastContext = createContext<{ push: (m: string, k?: ToastKind) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const push = useCallback((message: string, kind: ToastKind = 'default') => {
    const id = ++seq.current;
    // Stacks to a maximum of three (Part 15).
    setItems((prev) => [...prev.slice(-2), { id, message, kind }]);
    setTimeout(() => setItems((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))), 4000);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast--${t.kind}`} data-leaving={t.leaving || undefined}>
            <span aria-hidden="true" className="toast__glyph">
              {t.kind === 'error' ? '⚠' : t.kind === 'success' ? '◉' : '◌'}
            </span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { push: () => {} };
  return ctx;
}

/** Fires a toast from anywhere, including non-React code paths. */
export function useToastBridge() {
  const { push } = useToast();
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ message: string; kind?: ToastKind }>).detail;
      if (detail?.message) push(detail.message, detail.kind);
    };
    window.addEventListener('ui:toast', handler);
    return () => window.removeEventListener('ui:toast', handler);
  }, [push]);
}

export function toast(message: string, kind: ToastKind = 'default') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('ui:toast', { detail: { message, kind } }));
}
