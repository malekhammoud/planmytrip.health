import { afterEach, describe, expect, it, vi } from "vitest";
import { settleWithin } from "./pendingWrites";

afterEach(() => {
  vi.useRealTimers();
});

describe("settleWithin", () => {
  it("settles when every promise finishes or rejects", async () => {
    await expect(
      settleWithin([Promise.resolve(), Promise.reject(new Error("write failed"))]),
    ).resolves.toBe("settled");
  });

  it("returns immediately when nothing is pending", async () => {
    await expect(settleWithin([])).resolves.toBe("settled");
  });

  it("times out without waiting for a hung write", async () => {
    vi.useFakeTimers();
    const pending = settleWithin([new Promise<void>(() => {})], 2_000);
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(pending).resolves.toBe("timeout");
  });
});
