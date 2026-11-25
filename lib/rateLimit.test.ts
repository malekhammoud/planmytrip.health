import { describe, expect, it } from "vitest";
import { createDailyLimiter, createWindowLimiter } from "./rateLimit";

describe("fixed-window limiter", () => {
  it("allows the configured budget, denies extra calls, and resets with time", () => {
    let now = 1_000;
    const limiter = createWindowLimiter({
      limit: 2,
      windowMs: 1_000,
      now: () => now,
    });

    expect(limiter.consume("user-a")).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    expect(limiter.consume("user-a")).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    expect(limiter.consume("user-a")).toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfterSec: 1,
    });
    expect(limiter.consume("user-b").allowed).toBe(true);

    now += 1_000;
    expect(limiter.consume("user-a").allowed).toBe(true);
  });

  it("denies every request when the limit is zero", () => {
    const limiter = createWindowLimiter({
      limit: 0,
      windowMs: 60_000,
      now: () => 1_000,
    });
    expect(limiter.consume("user-a").allowed).toBe(false);
  });

  it("clears all buckets on reset", () => {
    const limiter = createWindowLimiter({
      limit: 1,
      windowMs: 60_000,
      now: () => 1_000,
    });
    expect(limiter.consume("user-a").allowed).toBe(true);
    expect(limiter.consume("user-a").allowed).toBe(false);
    limiter.reset();
    expect(limiter.consume("user-a").allowed).toBe(true);
  });
});

describe("daily limiter", () => {
  it("resets at UTC midnight with a retry hint inside the current day", () => {
    let now = Date.parse("2026-11-25T23:59:00.000Z");
    const limiter = createDailyLimiter({ limit: 1, now: () => now });

    expect(limiter.consume("user-a")).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    expect(limiter.consume("user-a")).toMatchObject({
      allowed: false,
      retryAfterSec: 60,
    });
    expect(limiter.consume("user-b").allowed).toBe(true);

    now = Date.parse("2026-11-26T00:00:01.000Z");
    expect(limiter.consume("user-a").allowed).toBe(true);
  });

  it("denies every request when the daily limit is zero", () => {
    const limiter = createDailyLimiter({ limit: 0, now: () => 1_000 });
    expect(limiter.consume("user-a").allowed).toBe(false);
  });
});
