/**
 * Bounded waiting for best-effort capture and cache writes.
 *
 * Inputs: pending write promises and a short grace period.
 * Outputs: "settled" when every promise finished, or "timeout" when the grace expired.
 * Invariants: every rejection is observed by allSettled; the timer is cleared on a normal
 * finish; a timed-out write can finish in the background without holding the SSE stream.
 */

/** Default grace for capture and cache writes before a stream closes. */
export const WRITE_GRACE_MS = 2_000;

/** Whether the pending writes finished inside the grace. */
export type SettleOutcome = "settled" | "timeout";

/**
 * Waits for every promise, but never longer than `timeoutMs`. The promises are expected
 * to be best-effort and already bound to their own error handling.
 */
export async function settleWithin(
  promises: readonly Promise<unknown>[],
  timeoutMs: number = WRITE_GRACE_MS,
): Promise<SettleOutcome> {
  if (promises.length === 0) return "settled";
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<SettleOutcome>((resolve) => {
    timer = setTimeout(() => resolve("timeout"), Math.max(0, timeoutMs));
  });
  try {
    return await Promise.race([
      Promise.allSettled(promises).then((): SettleOutcome => "settled"),
      timeout,
    ]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}
