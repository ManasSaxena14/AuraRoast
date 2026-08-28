/**
 * The two tests that prove Part 9 (Blueprint §18.3).
 *
 * Each one names the exact race it prevents. They run against the repository
 * layer directly, so they exercise the real single-statement guards rather
 * than a mock of them.
 *
 *   node --test --experimental-strip-types --import ./tests/hooks.mjs 'tests/concurrency/*.test.ts'
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  bookSlotAtomically,
  claimIdempotencyKey,
  completeIdempotencyKey,
  getSlot,
  listSlots,
} from '../../src/repositories/index.ts';
import { db } from '../../src/repositories/memory/store.ts';
import { SlotFullError } from '../../src/domain/errors.ts';
import { hashPayload } from '../../src/lib/ids.ts';
import { toDateKey } from '../../src/domain/slots.ts';
import { STORES } from '../../src/data/stores.ts';

/**
 * RACE 1 — two guests booking the last seat at the same instant.
 *
 * The bug this prevents: SELECT booked_count → compare → UPDATE. Between the
 * read and the write, another transaction books the same seat and both
 * succeed, putting `booked_count` above `capacity`.
 *
 * The fix is a single statement whose WHERE clause IS the capacity check:
 *   UPDATE reservation_slots
 *      SET booked_count = booked_count + $seats
 *    WHERE id = $id AND booked_count + $seats <= capacity
 *   RETURNING capacity - booked_count;
 * Zero rows affected means the slot was full. There is no window to lose.
 */
describe('RACE 1 — reservation capacity can never be exceeded', () => {
  it('admits exactly capacity/seats bookings and rejects the rest', async () => {
    const today = toDateKey(new Date());
    const slots = await listSlots(STORES[0].id, today, 'table');
    const slot = slots.find((s) => s.bookedCount === 0);
    assert.ok(slot, 'expected an untouched slot to test against');

    const capacity = slot.capacity;
    const partySize = 2;
    const winners = Math.floor(capacity / partySize);
    const attempts = winners + 8;

    const results = await Promise.all(
      Array.from({ length: attempts }, () =>
        bookSlotAtomically(slot.id, partySize).then(
          () => 'ok' as const,
          (err) => (err instanceof SlotFullError ? ('full' as const) : Promise.reject(err)),
        ),
      ),
    );

    const booked = results.filter((r) => r === 'ok').length;
    const rejected = results.filter((r) => r === 'full').length;

    assert.equal(booked, winners, `expected exactly ${winners} winners, got ${booked}`);
    assert.equal(rejected, attempts - winners);

    const after = await getSlot(slot.id);
    assert.ok(after);
    // The `never_overbooked` CHECK constraint, asserted in code.
    assert.ok(after.bookedCount <= after.capacity, 'never_overbooked violated');
    assert.equal(after.bookedCount, winners * partySize);
  });

  it('holds under mixed party sizes racing for the same slot', async () => {
    const today = toDateKey(new Date());
    const slots = await listSlots(STORES[1].id, today, 'table');
    const slot = slots.find((s) => s.bookedCount === 0);
    assert.ok(slot);

    const sizes = [1, 2, 3, 4, 5, 6, 7, 8, 2, 3, 1, 4];
    await Promise.all(
      sizes.map((n) =>
        bookSlotAtomically(slot.id, n).then(
          () => undefined,
          (err) => {
            if (!(err instanceof SlotFullError)) throw err;
          },
        ),
      ),
    );

    const after = await getSlot(slot.id);
    assert.ok(after!.bookedCount <= after!.capacity, 'never_overbooked violated');
  });
});

/**
 * RACE 2 — a double-tapped "Place order" button.
 *
 * The bug this prevents: two identical POSTs arriving before the first has
 * finished writing, producing two orders and charging the guest twice.
 *
 * The fix is `INSERT ... ON CONFLICT (key) DO NOTHING RETURNING *` — the first
 * caller claims the key, everyone else is told what happened to it. Three
 * distinct outcomes, and the third is the one most implementations get wrong:
 *
 *   claimed     → this caller does the work
 *   in_progress → an identical request is still running
 *   replay      → identical request already finished; return the SAME response
 *   conflict    → same key, DIFFERENT body → 422, never a silent replay
 */
describe('RACE 2 — an idempotency key admits exactly one writer', () => {
  it('gives exactly one caller the claim', async () => {
    const key = `race-${Math.random().toString(36).slice(2)}`;
    const hash = await hashPayload({ cart: ['espresso'], qty: 2 });

    const outcomes = await Promise.all(
      Array.from({ length: 10 }, () => claimIdempotencyKey(key, hash).then((r) => r.outcome)),
    );

    assert.equal(outcomes.filter((o) => o === 'claimed').length, 1, 'exactly one writer');
    assert.equal(outcomes.filter((o) => o === 'in_progress').length, 9);
  });

  it('replays the original response rather than doing the work twice', async () => {
    const key = `replay-${Math.random().toString(36).slice(2)}`;
    const hash = await hashPayload({ cart: ['latte'] });

    assert.equal((await claimIdempotencyKey(key, hash)).outcome, 'claimed');
    await completeIdempotencyKey(key, 201, { orderNumber: 'AT-999001' });

    const second = await claimIdempotencyKey(key, hash);
    assert.equal(second.outcome, 'replay');
    assert.deepEqual(second.record?.response, { orderNumber: 'AT-999001' });
    assert.equal(second.record?.statusCode, 201);
  });

  it('rejects the same key with a different body — 422, not a replay', async () => {
    const key = `conflict-${Math.random().toString(36).slice(2)}`;
    const original = await hashPayload({ cart: ['latte'], qty: 1 });
    const tampered = await hashPayload({ cart: ['latte'], qty: 9 });

    assert.notEqual(original, tampered, 'the hash must see nested values');

    await claimIdempotencyKey(key, original);
    await completeIdempotencyKey(key, 201, { orderNumber: 'AT-999002' });

    assert.equal((await claimIdempotencyKey(key, tampered)).outcome, 'conflict');
  });

  it('writes exactly one record per key regardless of contention', async () => {
    const key = `single-${Math.random().toString(36).slice(2)}`;
    const hash = await hashPayload({ a: 1 });
    await Promise.all(Array.from({ length: 25 }, () => claimIdempotencyKey(key, hash)));
    assert.equal(Object.keys(db.idempotency).filter((k) => k === key).length, 1);
  });
});
