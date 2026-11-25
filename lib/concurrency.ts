/**
 * Process-local concurrency and cooldown guards for expensive live runs.
 *
 * Inputs: one account id and configured per-account/global limits.
 * Outputs: a release-able lease, or a bounded denial reason with a retry hint.
 * Invariants: one account never exceeds its share; the global cap counts every active
 * lease; a released lease is idempotent; a cooldown only starts after a real release.
 * The guard is pure state with an injectable clock so tests need no timers.
 */

/** Why a live run could not start. */
export type ConcurrencyDenialReason = "user" | "global" | "cooldown";

/** A refused acquisition with a bounded retry hint. */
export interface ConcurrencyDenial {
  ok: false;
  reason: ConcurrencyDenialReason;
  /** Whole seconds before the caller should retry. */
  retryAfterSec: number;
}

/** Options for one guard. Limits below one fall back to one. */
export interface ConcurrencyGuardOptions {
  /** Simultaneous live runs for one account. */
  perUserLimit: number;
  /** Simultaneous live runs across this process. */
  globalLimit: number;
  /** Optional pause after a run releases its slot. */
  cooldownMs?: number;
  /** Injectable clock; defaults to Date.now. */
  now?: () => number;
}

/** An acquired slot; release once when the run finishes, cancels, or fails. */
export interface ConcurrencyLease {
  release(options?: { cooldown?: boolean }): void;
}

/** A successful acquisition. */
export interface ConcurrencyGrant {
  ok: true;
  lease: ConcurrencyLease;
}

/** The result of one acquisition attempt. */
export type ConcurrencyResult = ConcurrencyGrant | ConcurrencyDenial;

/** A reusable guard over one class of live work. */
export interface ConcurrencyGuard {
  acquire(userId: string): ConcurrencyResult;
  reset(): void;
}

const COOLDOWN_KEYS_MAX = 10_000;

function positiveInt(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 1 ? Math.trunc(value) : fallback;
}

/**
 * Builds one guard. The caller owns the returned instance and can reset it between
 * requests in tests. A cooldown never applies to a denied acquisition.
 */
export function createConcurrencyGuard(
  options: ConcurrencyGuardOptions,
): ConcurrencyGuard {
  const perUserLimit = positiveInt(options.perUserLimit, 1);
  const globalLimit = positiveInt(options.globalLimit, perUserLimit);
  const cooldownMs =
    Number.isFinite(options.cooldownMs) && (options.cooldownMs ?? 0) > 0
      ? Math.trunc(options.cooldownMs ?? 0)
      : 0;
  const now = options.now ?? Date.now;
  const activeByUser = new Map<string, number>();
  const cooldownUntil = new Map<string, number>();
  let activeGlobal = 0;

  function pruneCooldowns(nowMs: number): void {
    if (cooldownUntil.size <= COOLDOWN_KEYS_MAX) return;
    for (const [key, until] of cooldownUntil) {
      if (until <= nowMs) cooldownUntil.delete(key);
    }
    // A pathological account churn must not grow memory without bound. Dropping the
    // remaining cooldowns only relaxes pacing; the active and per-user caps stay exact.
    if (cooldownUntil.size > COOLDOWN_KEYS_MAX) cooldownUntil.clear();
  }

  function deny(reason: ConcurrencyDenialReason, retryAfterSec: number): ConcurrencyDenial {
    return { ok: false, reason, retryAfterSec: Math.max(1, Math.ceil(retryAfterSec)) };
  }

  return {
    acquire(userId: string): ConcurrencyResult {
      const nowMs = now();
      pruneCooldowns(nowMs);

      const until = cooldownUntil.get(userId);
      if (until !== undefined) {
        if (until > nowMs) {
          return deny("cooldown", (until - nowMs) / 1_000);
        }
        cooldownUntil.delete(userId);
      }

      if ((activeByUser.get(userId) ?? 0) >= perUserLimit) {
        return deny("user", 1);
      }
      if (activeGlobal >= globalLimit) {
        return deny("global", 1);
      }

      activeByUser.set(userId, (activeByUser.get(userId) ?? 0) + 1);
      activeGlobal += 1;
      let released = false;

      return {
        ok: true,
        lease: {
          release(releaseOptions?: { cooldown?: boolean }): void {
            if (released) return;
            released = true;
            activeGlobal = Math.max(0, activeGlobal - 1);
            const remaining = (activeByUser.get(userId) ?? 1) - 1;
            if (remaining <= 0) activeByUser.delete(userId);
            else activeByUser.set(userId, remaining);

            if (releaseOptions?.cooldown === false || cooldownMs === 0) return;
            cooldownUntil.set(userId, now() + cooldownMs);
          },
        },
      };
    },
    reset(): void {
      activeByUser.clear();
      cooldownUntil.clear();
      activeGlobal = 0;
    },
  };
}
