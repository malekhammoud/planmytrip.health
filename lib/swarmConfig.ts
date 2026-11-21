/**
 * Run limits and retry copy for the three TinyFish workers.
 *
 * Inputs: none. Outputs: one frozen constants object used by the route, the client, and
 * the UI. Invariants: the route budget, the upstream run limits, and our client timeout
 * stay in one place so a run cannot outlive its SSE response.
 */

// VERIFY: TinyFish accepts max_steps 1..500 and max_duration_seconds 1..; 60 steps and
// 100 seconds keep one worker inside the 120-second route budget. Recheck after a live
// run reports MAX_STEPS_EXCEEDED or TIMEOUT.
export const SWARM_RUN_LIMITS = {
  /** Hard cap on agent tool-call steps per worker. */
  maxSteps: 60,
  /** Upstream wall-clock cap per worker, in seconds. */
  maxDurationSeconds: 100,
  /** Cursor style requested for every worker. */
  cursorStyle: "standard",
  /** Client-side worker timeout; slightly above the upstream cap. */
  clientTimeoutMs: 120_000,
  /** The route's declared maxDuration, in seconds. */
  routeBudgetSeconds: 120,
} as const;

/** Calm copy emitted as worker_note immediately before a retry. */
export const SWARM_RETRY_NOTES = {
  schema: "The service rejected the output schema. Retrying without it.",
  stealth: "Site blocked the standard browser. Retrying with stealth.",
} as const;
