/**
 * Run limits and retry copy for the three TinyFish workers.
 *
 * Inputs: none. Outputs: one frozen constants object used by the route, the client, and
 * the UI. Invariants: the route budget, the upstream run limits, and our client timeout
 * stay in one place so a run cannot outlive its SSE response.
 */

// VERIFY: TinyFish's custom max_steps is beta-gated for this account; sending it returns
// HTTP 403 FORBIDDEN. Omit max_steps and keep max_duration_seconds at 100; the provider's
// queue delay and recording finalization can put one worker's wall clock above two minutes,
// so the client budget is 280 seconds inside a 300-second route. The provider's documented
// default is 150 steps. Recheck after the account is enabled for custom max steps.
export const SWARM_RUN_LIMITS = {
  /** Provider default steps, used only for display; we do not send max_steps. */
  providerDefaultMaxSteps: 150,
  /** Upstream wall-clock cap per worker, in seconds. */
  maxDurationSeconds: 100,
  /** Cursor style requested for every worker. */
  cursorStyle: "standard",
  /** Client-side worker timeout, covering provider queue delay plus the upstream cap. */
  clientTimeoutMs: 280_000,
  /** The route's declared maxDuration, in seconds. */
  routeBudgetSeconds: 300,
} as const;

/** Calm copy emitted as worker_note immediately before a retry. */
export const SWARM_RETRY_NOTES = {
  schema: "The service rejected the output schema. Retrying without it.",
  stealth: "Site blocked the standard browser. Retrying with stealth.",
  transient: "The check was interrupted. Retrying once.",
} as const;
