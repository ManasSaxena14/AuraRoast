/**
 * Typed domain failures. Route handlers map `.status` straight to HTTP.
 *
 * Fields are declared and assigned explicitly rather than via constructor
 * parameter properties — that syntax needs a TypeScript *transform*, and the
 * domain layer is deliberately runnable by `node --test` with type stripping
 * alone, no build step (§18.1).
 */
export class DomainError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, code: string, status = 400, details?: unknown) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class SlotFullError extends DomainError {
  constructor(remaining: number) {
    super('That slot just filled up.', 'slot_full', 409, { remaining });
  }
}

export class IllegalTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super(`An order cannot go from ${from} to ${to}.`, 'illegal_transition', 409, { from, to });
  }
}

export class IdempotencyConflictError extends DomainError {
  constructor() {
    super(
      'This idempotency key was already used with a different request body.',
      'idempotency_conflict',
      422,
    );
  }
}

export class MissingIdempotencyKeyError extends DomainError {
  constructor() {
    super(
      'An Idempotency-Key header is required to place an order.',
      'idempotency_key_required',
      400,
    );
  }
}

export class RateLimitedError extends DomainError {
  constructor(retryAfterSec: number) {
    super('Too many requests. Give it a moment.', 'rate_limited', 429, { retryAfterSec });
  }
}

export class NotFoundError extends DomainError {
  constructor(what: string) {
    super(`${what} not found.`, 'not_found', 404);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Not permitted.') {
    super(message, 'forbidden', 403);
  }
}
