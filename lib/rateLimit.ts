/**
 * Process-local request budgets for authenticated expensive paths.
 *
 * Inputs: one account key and a configured limit/window.
 * Outputs: an allow/deny decision, remaining capacity, and a retry hint.
 * Invariants: counters never go negative; a denied request consumes nothing; time is
 * injectable so tests are deterministic; maps are bounded by evicting expired or oldest
 * keys under account churn. These are fair-use guards, not a security boundary.
 */

/** The outcome of one budget check. */
export interface RateDecision {
  allowed: boolean;
  /** Whole seconds before retrying; zero when allowed. */
  retryAfterSec: number;
  /** Capacity left after this call. */
  remaining: number;
}

/** A reusable request budget. */
export interface RateLimiter {
  consume(key: string): RateDecision;
  reset(): void;
}

/** Fixed-window options. */
export interface WindowLimitOptions {
  /** Requests allowed per key per window. Zero denies every request. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Maximum remembered keys before expired/oldest keys are evicted. */
  maxKeys?: number;
  /** Injectable clock; defaults to Date.now. */
  now?: () => number;
}

/** Daily options; the window resets at UTC midnight. */
export interface DailyLimitOptions {
  /** Requests allowed per key per UTC day. Zero denies every request. */
  limit: number;
  /** Maximum remembered keys before stale/oldest keys are evicted. */
  maxKeys?: number;
  /** Injectable clock; defaults to Date.now. */
  now?: () => number;
}

const DEFAULT_MAX_KEYS = 10_000;

function boundedLimit(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function positiveWindow(value: number): number {
  return Number.isFinite(value) && value >= 1 ? Math.trunc(value) : 1;
}

function retrySeconds(ms: number): number {
  return Math.max(1, Math.ceil(ms / 1_000));
}

interface WindowBucket {
  count: number;
  resetAt: number;
}

/**
 * Builds a fixed-window limiter. A key's first request starts its window; a denied call
 * leaves the count unchanged. The map is trimmed only when it grows past `maxKeys`.
 */
export function createWindowLimiter(options: WindowLimitOptions): RateLimiter {
  const limit = boundedLimit(options.limit);
  const windowMs = positiveWindow(options.windowMs);
  const maxKeys = Math.max(1, Math.trunc(options.maxKeys ?? DEFAULT_MAX_KEYS));
  const now = options.now ?? Date.now;
  const buckets = new Map<string, WindowBucket>();

  function trim(nowMs: number): void {
    if (buckets.size <= maxKeys) return;
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= nowMs) buckets.delete(key);
    }
    while (buckets.size > maxKeys) {
      const oldest = buckets.keys().next().value;
      if (oldest === undefined) break;
      buckets.delete(oldest);
    }
  }

  return {
    consume(key: string): RateDecision {
      const nowMs = now();
      let bucket = buckets.get(key);
      if (bucket === undefined || bucket.resetAt <= nowMs) {
        bucket = { count: 0, resetAt: nowMs + windowMs };
        buckets.set(key, bucket);
        trim(nowMs);
      }
      if (bucket.count >= limit) {
        return {
          allowed: false,
          retryAfterSec: retrySeconds(bucket.resetAt - nowMs),
          remaining: 0,
        };
      }
      bucket.count += 1;
      return {
        allowed: true,
        retryAfterSec: 0,
        remaining: Math.max(0, limit - bucket.count),
      };
    },
    reset(): void {
      buckets.clear();
    },
  };
}

interface DailyBucket {
  day: string;
  count: number;
}

function utcDay(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function untilNextUtcMidnightMs(nowMs: number): number {
  const date = new Date(nowMs);
  const next = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
  );
  return Math.max(1, next - nowMs);
}

/**
 * Builds a per-UTC-day limiter. A new day resets that key's count. The map is bounded so
 * one account cannot grow it without limit.
 */
export function createDailyLimiter(options: DailyLimitOptions): RateLimiter {
  const limit = boundedLimit(options.limit);
  const maxKeys = Math.max(1, Math.trunc(options.maxKeys ?? DEFAULT_MAX_KEYS));
  const now = options.now ?? Date.now;
  const buckets = new Map<string, DailyBucket>();

  function trim(day: string): void {
    if (buckets.size <= maxKeys) return;
    for (const [key, bucket] of buckets) {
      if (bucket.day !== day) buckets.delete(key);
    }
    while (buckets.size > maxKeys) {
      const oldest = buckets.keys().next().value;
      if (oldest === undefined) break;
      buckets.delete(oldest);
    }
  }

  return {
    consume(key: string): RateDecision {
      const nowMs = now();
      const day = utcDay(nowMs);
      let bucket = buckets.get(key);
      if (bucket === undefined || bucket.day !== day) {
        bucket = { day, count: 0 };
        buckets.set(key, bucket);
        trim(day);
      }
      if (bucket.count >= limit) {
        return {
          allowed: false,
          retryAfterSec: retrySeconds(untilNextUtcMidnightMs(nowMs)),
          remaining: 0,
        };
      }
      bucket.count += 1;
      return {
        allowed: true,
        retryAfterSec: 0,
        remaining: Math.max(0, limit - bucket.count),
      };
    },
    reset(): void {
      buckets.clear();
    },
  };
}
