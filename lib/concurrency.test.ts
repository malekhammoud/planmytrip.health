import { describe, expect, it } from "vitest";
import { createConcurrencyGuard } from "./concurrency";

describe("concurrency guard", () => {
  it("enforces one live run per account and a global cap", () => {
    const guard = createConcurrencyGuard({
      perUserLimit: 1,
      globalLimit: 2,
      cooldownMs: 5_000,
      now: () => 1_000,
    });

    const first = guard.acquire("user-a");
    expect(first.ok).toBe(true);
    expect(guard.acquire("user-a")).toMatchObject({
      ok: false,
      reason: "user",
      retryAfterSec: 1,
    });

    const second = guard.acquire("user-b");
    expect(second.ok).toBe(true);
    expect(guard.acquire("user-c")).toMatchObject({
      ok: false,
      reason: "global",
    });
  });

  it("applies a cooldown only after a release and never twice", () => {
    let now = 1_000;
    const guard = createConcurrencyGuard({
      perUserLimit: 1,
      globalLimit: 2,
      cooldownMs: 5_000,
      now: () => now,
    });

    const grant = guard.acquire("user-a");
    expect(grant.ok).toBe(true);
    if (!grant.ok) return;
    grant.lease.release();
    grant.lease.release();

    expect(guard.acquire("user-b").ok).toBe(true);
    expect(guard.acquire("user-a")).toMatchObject({
      ok: false,
      reason: "cooldown",
      retryAfterSec: 5,
    });

    now += 5_000;
    expect(guard.acquire("user-a").ok).toBe(true);
  });

  it("can release without a cooldown and reset all state", () => {
    const guard = createConcurrencyGuard({
      perUserLimit: 1,
      globalLimit: 1,
      cooldownMs: 5_000,
      now: () => 1_000,
    });
    const grant = guard.acquire("user-a");
    if (!grant.ok) throw new Error("expected a grant");
    grant.lease.release({ cooldown: false });
    expect(guard.acquire("user-a").ok).toBe(true);

    guard.reset();
    expect(guard.acquire("user-a").ok).toBe(true);
  });

  it("treats an invalid limit as one and a zero cooldown as immediate reuse", () => {
    const guard = createConcurrencyGuard({
      perUserLimit: Number.NaN,
      globalLimit: 0,
      cooldownMs: 0,
      now: () => 1_000,
    });
    const grant = guard.acquire("user-a");
    if (!grant.ok) throw new Error("expected a grant");
    grant.lease.release();
    expect(guard.acquire("user-a").ok).toBe(true);
  });
});
