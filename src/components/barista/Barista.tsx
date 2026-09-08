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
        aria-label={open ? 'Close the barista' : 'Ask the barista'}
      >
        <Halo size={54} stroke={1.5} progress={open ? 1 : 0.72} animateOnMount={false} />
        <span className="barista-launcher__glyph" aria-hidden="true">
          {open ? '✕' : '◍'}
        </span>
      </button>

      {open ? (
        <section ref={panelRef} className="barista" role="dialog" aria-modal="true" aria-label="AI Barista">
          <header className="barista__head row-between">
            <div>
              <p className="eyebrow" style={{ marginBottom: 4 }}>
                The bar
              </p>
              <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                Real tool calls into the live menu — not a scripted demo.
              </p>
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
