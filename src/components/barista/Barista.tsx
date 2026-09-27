'use client';
/**
 * The AI Barista (Blueprint §13.7, §6.5).
 *
 * It lives OUTSIDE <PageTransition> precisely so a conversation survives
 * navigation. Closing a chat because someone opened the menu would be a real
 * product failure. It expands in place and never navigates.
 *
 * No per-character typewriter effect — it reads as gimmicky and is objectively
 * slower to read than text that is simply there (Part 15).
 */
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Halo } from '@/components/motion/Halo';
import { lockScroll, unlockScroll } from '@/components/motion/SmoothScroll';
import { useCart } from '@/components/cart/CartProvider';
import { toast } from '@/components/toast/ToastProvider';
import { defaultSelection } from '@/domain/brew-plan';
import type { ChatAction } from '@/services/chat';
import type { Drink, Modifier } from '@/domain/types';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  action?: ChatAction | null;
  tools?: string[];
}

const SUGGESTIONS = [
  'Something sharp to wake me up',
  'Cold, not sweet',
  'What is dairy-free?',
  'Book me a table',
];

export function Barista({ drinks, modifiers }: { drinks: Drink[]; modifiers: Modifier[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content:
        'Morning. Tell me a mood, a taste, or a constraint — sharp, heavy, dairy-free, cold — and I will find you the nearest real thing on the bar.',
    },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const { add, open: openCart } = useCart();

  // Same modal contract as CartDrawer (§14.2): scroll is locked, so focus must
  // not be able to walk out behind the panel where it cannot be scrolled into view.
  useEffect(() => {
    if (!open) return;
    restoreFocus.current = document.activeElement as HTMLElement;
    lockScroll();
    panelRef.current?.querySelector<HTMLElement>('button, a, input')?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key !== 'Tab' || !panelRef.current) return;
      // Focus trap.
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      unlockScroll();
      restoreFocus.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || busy) return;
      setInput('');
      setMessages((m) => [...m, { role: 'user', content: clean }]);
      setBusy(true);
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: clean,
            history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
          }),
        });
        if (res.status === 429) {
          setMessages((m) => [
            ...m,
            { role: 'assistant', content: 'Give me a moment — too many questions at once.' },
          ]);
          return;
        }
        const data = (await res.json()) as { reply: string; action: ChatAction | null; toolsUsed: string[] };
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: data.reply, action: data.action, tools: data.toolsUsed },
        ]);
      } catch {
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: 'The line dropped. Ask me again.' },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy, messages],
  );

  const runAction = useCallback(
    (action: ChatAction) => {
      if (action.kind !== 'add_to_cart') return;
      const drink = drinks.find((d) => d.slug === action.drinkSlug);
      if (!drink) return;
      add(drink, defaultSelection(drink, modifiers), action.quantity);
      toast(`${drink.name} added`, 'success');
      openCart();
      setOpen(false);
    },
    [add, drinks, modifiers, openCart],
  );

  return (
    <>
      <button
        className="barista-launcher"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Close the AI barista' : 'Ask the AI barista'}
      >
        <Halo size={54} stroke={1.5} progress={open ? 1 : 0.72} animateOnMount={false} />
        <span className="barista-launcher__glyph" aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {open ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="6" width="18" height="14" rx="4" />
              <circle cx="8.5" cy="12" r="1.5" fill="currentColor" />
              <circle cx="15.5" cy="12" r="1.5" fill="currentColor" />
              <path d="M10 16h4" strokeWidth="2" />
              <path d="M12 2v4" />
              <circle cx="12" cy="2" r="1" fill="currentColor" />
            </svg>
          )}
        </span>
      </button>

      {open ? (
        <section ref={panelRef} className="barista" role="dialog" aria-modal="true" aria-label="AI Barista">
          <header className="barista__head row-between" style={{ padding: 'var(--space-4) var(--space-5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'rgb(242 206 147 / 0.15)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--aura-500)',
                  border: '1px solid rgb(242 206 147 / 0.3)',
                  boxShadow: '0 0 12px rgb(242 206 147 / 0.2)',
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="6" width="18" height="14" rx="4" />
                  <circle cx="8.5" cy="12" r="1.5" fill="currentColor" />
                  <circle cx="15.5" cy="12" r="1.5" fill="currentColor" />
                  <path d="M10 16h4" strokeWidth="2" />
                  <path d="M12 2v4" />
                  <circle cx="12" cy="2" r="1" fill="currentColor" />
                </svg>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <p className="eyebrow" style={{ marginBottom: 0, color: 'var(--aura-400)', fontWeight: 600 }}>
                    AI Barista
                  </p>
                  <span style={{ fontSize: 10, background: 'rgb(46 160 67 / 0.2)', color: '#56d364', padding: '1px 6px', borderRadius: 99, fontWeight: 600 }}>
                    ● Online
                  </span>
                </div>
                <p className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 2 }}>
                  Live menu recommendations & order intelligence.
                </p>
              </div>
            </div>
            <button className="btn btn--ghost btn--sm" onClick={() => setOpen(false)} aria-label="Close">
              ✕
            </button>
          </header>

          <div className="barista__list" ref={listRef} role="log" aria-live="polite" aria-relevant="additions">
            {messages.map((m, i) => (
              <div key={i} className={`bubble bubble--${m.role}`}>
                <p>{m.content}</p>
                {m.tools?.length ? (
                  <p className="bubble__tools mono">
                    {m.tools.map((t) => `→ ${t}()`).join('  ')}
                  </p>
                ) : null}
                {m.action?.kind === 'add_to_cart' ? (
                  <button className="btn btn--primary btn--sm" onClick={() => runAction(m.action!)}>
                    Add {m.action.drinkName}
                  </button>
                ) : null}
                {m.action?.kind === 'open' ? (
                  <Link href={m.action.href} className="btn btn--outline btn--sm" onClick={() => setOpen(false)}>
                    {m.action.label}
                  </Link>
                ) : null}
              </div>
            ))}
            {busy ? (
              <div className="bubble bubble--assistant bubble--thinking">
                <Halo size={22} stroke={1.4} progress={0.3} spinning animateOnMount={false} />
                <span className="muted">Checking the bar…</span>
              </div>
            ) : null}
          </div>

          <div className="barista__suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="chip" onClick={() => send(s)} disabled={busy}>
                {s}
              </button>
            ))}
          </div>

          <form
            className="barista__form"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <input
              className="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask for something…"
              aria-label="Message the barista"
              // Matches the server's own cap in /api/chat. Without it a long
              // paste is accepted here and then rejected with a bare 400.
              maxLength={2000}
              // readOnly, not disabled: disabling the focused input mid-send drops
              // focus to <body> and the guest has to Tab the whole page back. The
              // `busy` guard in send() is what actually stops a double-submit.
              readOnly={busy}
            />
            <button className="btn btn--primary btn--sm" disabled={busy || !input.trim()}>
              Send
            </button>
          </form>
        </section>
      ) : null}
    </>
  );
}
