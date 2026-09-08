'use client';
import { useState } from 'react';
import { Reveal } from '@/components/motion/Reveal';
import { Button } from '@/components/ui/Button';
import { Field, TextareaField } from '@/components/ui/Field';
import { EmptyState, Rating } from '@/components/ui/bits';
import { toast } from '@/components/toast/ToastProvider';
import type { Review } from '@/domain/types';

/** Reviews stagger in; virtualized past 50 items by slicing the render window. */
const PAGE = 8;

export function ReviewList({ drinkId, initial }: { drinkId: string; initial: Review[] }) {
  const [reviews, setReviews] = useState(initial);
  const [shown, setShown] = useState(PAGE);
  const [writing, setWriting] = useState(false);
  const [author, setAuthor] = useState('');
  const [body, setBody] = useState('');
  const [rating, setRating] = useState(5);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drinkId, author, rating, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? 'That did not go through.', 'error');
        return;
      }
      setReviews((r) => [data.review, ...r]);
      setWriting(false);
      setAuthor('');
      setBody('');
      toast('Thanks — that is live.', 'success');
    } finally {
      setBusy(false);
    }
  }

  if (reviews.length === 0 && !writing) {
    return (
      <div className="stack">
        <EmptyState title="Nobody has said anything yet." body="Be the first. Two sentences is plenty." />
        <div className="row" style={{ justifyContent: 'center' }}>
          <Button onClick={() => setWriting(true)}>Write one</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      {writing ? (
        <form className="card stack" onSubmit={submit}>
          <div className="field-row">
            <Field label="Your name" value={author} onChange={(e) => setAuthor(e.target.value)} required maxLength={40} />
            <div className="field">
              <span className="field__label">Rating</span>
              <div className="row" style={{ gap: 'var(--space-2)' }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="chip"
                    data-active={rating === n || undefined}
                    onClick={() => setRating(n)}
                    aria-label={`${n} stars`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <TextareaField label="What did you think?" value={body} onChange={(e) => setBody(e.target.value)} maxLength={600} />
          <div className="row">
            <Button type="submit" variant="primary" loading={busy}>
              Post it
            </Button>
            <Button type="button" variant="ghost" onClick={() => setWriting(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="row">
          <Button size="sm" onClick={() => setWriting(true)}>
            Write a review
          </Button>
        </div>
      )}

      <Reveal variant="stagger" stagger={0.05} className="stack">
        {reviews.slice(0, shown).map((r) => (
          <article key={r.id} className="card">
            <div className="row-between" style={{ marginBottom: 'var(--space-2)' }}>
              <strong>{r.author}</strong>
              <Rating value={r.rating} />
            </div>
            <p className="muted">{r.body}</p>
            {/* Pinned to IST: drink pages are prerendered, so an unpinned zone
                formats the day differently on the server and on hydration. */}
            <p className="mono muted" style={{ fontSize: 10, marginTop: 'var(--space-3)' }}>
              {new Date(r.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                timeZone: 'Asia/Kolkata',
              })}
            </p>
          </article>
        ))}
      </Reveal>

      {shown < reviews.length ? (
        <div className="row" style={{ justifyContent: 'center' }}>
          <Button variant="ghost" onClick={() => setShown((s) => s + PAGE)}>
            Show {Math.min(PAGE, reviews.length - shown)} more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
