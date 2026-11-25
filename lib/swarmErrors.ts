/**
 * Calm, user-facing copy for every destination check failure code.
 *
 * Inputs: a SwarmErrorCode from a worker_error frame.
 * Outputs: one short sentence with no provider, billing, or account internals, plus a
 * retryable flag.
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
    message: "The destination check is not available right now. Try again later.",
    retryable: false,
  },
  timeout: {
    message: "The destination check took too long. Try again.",
    retryable: true,
  },
  site_blocked: {
    message: "The advisory page could not be opened. Try again.",
    retryable: true,
  },
  max_steps_exceeded: {
    message: "The check ended before it finished reading the page. Try again.",
    retryable: true,
  },
  rate_limit: {
    message: "The check is busy right now. Try again in a minute.",
    retryable: true,
  },
  insufficient_credits: {
    message: "The destination check is not available right now. Try again later.",
    retryable: false,
  },
  invalid_input: {
    message: "This trip could not be checked. Try again.",
    retryable: true,
  },
  forbidden: {
    message: "The destination check is not available right now. Try again later.",
    retryable: false,
  },
  cancelled: {
    message: "The check stopped before it finished. Try again.",
    retryable: true,
  },
  upstream_error: {
    message: "Something interrupted the check. Try again.",
    retryable: true,
  },
};

const SAFE_DEFAULT: SwarmErrorCopy = {
  message: "The destination check did not finish. Try again.",
  retryable: true,
};

/** Returns calm copy for a code, with a safe default for anything unrecognised. */
export function swarmErrorCopy(code: SwarmErrorCode | null): SwarmErrorCopy {
  if (code === null) return SAFE_DEFAULT;
  return COPY[code] ?? SAFE_DEFAULT;
}
