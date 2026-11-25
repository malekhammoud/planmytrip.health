import { describe, expect, it } from "vitest";
import { swarmErrorCopy } from "./swarmErrors";
import type { SwarmErrorCode } from "./swarmTypes";

const CODES: readonly SwarmErrorCode[] = [
  "missing_api_key",
  "timeout",
  "site_blocked",
  "max_steps_exceeded",
  "rate_limit",
  "insufficient_credits",
  "invalid_input",
  "forbidden",
  "cancelled",
  "upstream_error",
];

describe("swarmErrorCopy", () => {
  it("returns calm copy for every known code", () => {
    for (const code of CODES) {
      const copy = swarmErrorCopy(code);
      expect(copy.message.length).toBeGreaterThan(0);
      expect(copy.message.endsWith(".")).toBe(true);
      expect(copy.message).not.toMatch(
        /API|HTTP|stack|undefined|tinyfish|credit|stealth|rate limit|step limit|account/i,
      );
    }
  });

  it("has a safe default for an unknown code", () => {
    expect(swarmErrorCopy(null).retryable).toBe(true);
    expect(swarmErrorCopy("future_code" as SwarmErrorCode).message).toBe(
      "The destination check did not finish. Try again.",
    );
  });

  it("marks missing credentials and exhausted credits as not retryable", () => {
    expect(swarmErrorCopy("missing_api_key").retryable).toBe(false);
    expect(swarmErrorCopy("insufficient_credits").retryable).toBe(false);
    expect(swarmErrorCopy("site_blocked").retryable).toBe(true);
  });
});
