/**
 * Environment-configured guards for live planner, verification, venue, and geocoder work.
 *
 * Inputs: PLANMYTRIP_* limit variables and PLANMYTRIP_LIVE_DISABLED.
 * Outputs: process-wide concurrency guards and request budgets, plus one kill-switch check.
 * Invariants: one live run per account is always enforced; defaults stay small enough for
 * a single production host; invalid or missing values fall back to the safe default; lazy
 * creation lets tests stub the environment and reset the singletons.
 */

import {
  createConcurrencyGuard,
  type ConcurrencyGuard,
} from "./concurrency";
import {
  createDailyLimiter,
  createWindowLimiter,
  type RateLimiter,
} from "./rateLimit";

const MINUTE_MS = 60_000;

function envInt(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = process.env[name]?.trim();
  if (raw === undefined || raw.length === 0) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function envSeconds(name: string, fallback: number): number {
  return envInt(name, fallback, 0, 3_600) * 1_000;
}

/** True when new live checks must return a calm 503 without starting work. */
export function liveChecksDisabled(): boolean {
  return process.env.PLANMYTRIP_LIVE_DISABLED?.trim() === "1";
}

let plannerGuard: ConcurrencyGuard | null = null;
let swarmGuard: ConcurrencyGuard | null = null;
let venueGuard: ConcurrencyGuard | null = null;
let venueDaily: RateLimiter | null = null;
let geocodeBudget: RateLimiter | null = null;

/**
 * Planner guard: one live plan per account, two globally, 15-second cooldown by default.
 * An earlier run therefore cannot be restarted in a hot loop.
 */
export function plannerConcurrency(): ConcurrencyGuard {
  plannerGuard ??= createConcurrencyGuard({
    perUserLimit: 1,
    globalLimit: envInt("PLANMYTRIP_PLANNER_MAX_CONCURRENT", 2, 1, 20),
    cooldownMs: envSeconds("PLANMYTRIP_PLANNER_COOLDOWN_SEC", 15),
  });
  return plannerGuard;
}

/** Verification guard: one live check per account, three globally, 15-second cooldown. */
export function swarmConcurrency(): ConcurrencyGuard {
  swarmGuard ??= createConcurrencyGuard({
    perUserLimit: 1,
    globalLimit: envInt("PLANMYTRIP_SWARM_MAX_CONCURRENT", 3, 1, 20),
    cooldownMs: envSeconds("PLANMYTRIP_SWARM_COOLDOWN_SEC", 15),
  });
  return swarmGuard;
}

/** Venue guard: one live pass per account, two globally, 30-second cooldown. */
export function venueConcurrency(): ConcurrencyGuard {
  venueGuard ??= createConcurrencyGuard({
    perUserLimit: 1,
    globalLimit: envInt("PLANMYTRIP_VENUE_MAX_CONCURRENT", 2, 1, 20),
    cooldownMs: envSeconds("PLANMYTRIP_VENUE_COOLDOWN_SEC", 30),
  });
  return venueGuard;
}

/** Venue daily budget: eight passes per account per UTC day by default. */
export function venueDailyLimit(): RateLimiter {
  venueDaily ??= createDailyLimiter({
    limit: envInt("PLANMYTRIP_VENUE_DAILY_LIMIT", 8, 0, 100),
  });
  return venueDaily;
}

/** Geocoder budget: sixty requests per account per minute by default. */
export function geocodeLimiter(): RateLimiter {
  geocodeBudget ??= createWindowLimiter({
    limit: envInt("PLANMYTRIP_GEOCODE_PER_MINUTE", 60, 0, 600),
    windowMs: MINUTE_MS,
  });
  return geocodeBudget;
}

/** Clears every guard and budget; used by route tests between cases. */
export function resetLiveLimitsForTests(): void {
  plannerGuard = null;
  swarmGuard = null;
  venueGuard = null;
  venueDaily = null;
  geocodeBudget = null;
}
