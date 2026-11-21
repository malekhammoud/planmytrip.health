/**
 * Calm, user-facing copy for every TinyFish failure code.
 *
 * Inputs: a SwarmErrorCode from a worker_error frame.
 * Outputs: one short sentence with no provider internals, plus a retryable flag.
 * Invariants: unknown codes fall back to safe copy; no raw provider text is echoed.
 */

import type { SwarmErrorCode } from "@/lib/swarmTypes";

/** Copy and retry behavior for one error code. */
export interface SwarmErrorCopy {
  message: string;
  /** True when retrying the worker can plausibly succeed. */
  retryable: boolean;
}

const COPY: Record<SwarmErrorCode, SwarmErrorCopy> = {
  missing_api_key: {
    message: "The live check is not configured on this server. Retry after the key is set.",
    retryable: false,
  },
  timeout: {
    message: "The agent did not finish in time. Retry this check.",
    retryable: true,
  },
  site_blocked: {
    message: "The site blocked the browser. Retry once; the stealth profile will be used.",
    retryable: true,
  },
  max_steps_exceeded: {
    message: "The agent hit its step limit before finishing. Retry this check.",
    retryable: true,
  },
  rate_limit: {
    message: "TinyFish rate limit reached. Try again in a minute.",
    retryable: true,
  },
  insufficient_credits: {
    message: "The TinyFish account has no credits left. Check the plan.",
    retryable: false,
  },
  invalid_input: {
    message: "The agent service rejected this check. Retry this worker.",
    retryable: true,
  },
  cancelled: {
    message: "The agent run was cancelled. Retry this check.",
    retryable: true,
  },
  upstream_error: {
    message: "The agent check stopped unexpectedly. Retry this worker.",
    retryable: true,
  },
};

const SAFE_DEFAULT: SwarmErrorCopy = {
  message: "The agent check stopped unexpectedly. Retry this worker.",
  retryable: true,
};

/** Returns calm copy for a code, with a safe default for anything unrecognised. */
export function swarmErrorCopy(code: SwarmErrorCode | null): SwarmErrorCopy {
  if (code === null) return SAFE_DEFAULT;
  return COPY[code] ?? SAFE_DEFAULT;
}
