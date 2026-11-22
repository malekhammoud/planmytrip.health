/**
 * Run limits and retry copy for the three TinyFish workers.
 *
 * Inputs: none. Outputs: one frozen constants object used by the route, the client, and
 * the UI. Invariants: the route budget, the upstream run limits, and our client timeout
 * stay in one place so a run cannot outlive its SSE response.
 */

// VERIFY: TinyFish's custom max_steps is beta-gated for this account; sending it returns
// HTTP 403 FORBIDDEN. Omit max_steps and keep max_duration_seconds at 100 so one worker
// still fits the 120-second route budget. The provider's documented default is 150 steps.
// Recheck after the account is enabled for custom max steps.
export const SWARM_RUN_LIMITS = {
  /** Provider default steps, used only for display; we do not send max_steps. */
  providerDefaultMaxSteps: 150,
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
