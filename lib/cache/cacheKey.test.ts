/**
 * Cache identity tests: normalisation, exact keys, and the related plan identity.
 */

import { describe, expect, it } from "vitest";
import {
  buildPlanCacheKey,
  buildSwarmCacheKey,
  normalizeCacheText,
  planCacheIdentity,
} from "./cacheKey";
import type { PlannerRequest } from "@/lib/agent/agentTypes";

function request(overrides: Partial<PlannerRequest> = {}): PlannerRequest {
  return {
    destination: "London, Ontario",
    origin: "",
    days: 4,
    condition: "asthma_respiratory",
    medication: "albuterol",
    interests: "healthy vegan food",
    budget: "balanced",
    transport: "mixed",
    checkIn: "",
    travelers: 1,
    ...overrides,
  };
}

describe("cache keys", () => {
  it("normalises case, accents, punctuation, and whitespace", () => {
    expect(normalizeCacheText("  MontréAL,  Québec ")).toBe("montreal quebec");
    expect(normalizeCacheText("London, Ontario")).toBe("london ontario");
  });

  it("matches the same trip across case, punctuation, province, and opaque ids", () => {
    const left = buildPlanCacheKey(request());
    const right = buildPlanCacheKey(
      request({
        destination: "  london, ON ",
        medication: "Albuterol",
        runId: "93575f5b-169d-4a9b-a1e3-0a95ce523f60",
        installId: "979aa7db-905e-4959-aa1a-ae300f2fc87f",
      }),
    );
    expect(right).toBe(left);
  });

  it("separates preferences, days, conditions, and transport", () => {
    const base = buildPlanCacheKey(request());
    expect(buildPlanCacheKey(request({ interests: "quiet food" }))).not.toBe(base);
    expect(buildPlanCacheKey(request({ days: 5 }))).not.toBe(base);
    expect(buildPlanCacheKey(request({ condition: "cardiac_hypertension" }))).not.toBe(base);
    expect(buildPlanCacheKey(request({ transport: "walk" }))).not.toBe(base);
  });

  it("matches an autocomplete label that includes the country", () => {
    expect(
      buildPlanCacheKey(request({ destination: "London, Ontario, Canada" })),
    ).toBe(buildPlanCacheKey(request()));
    expect(
      buildPlanCacheKey(request({ destination: "London, ON, Canada" })),
    ).toBe(buildPlanCacheKey(request()));
  });

  it("keeps a broad identity for the related-request fallback", () => {
    expect(planCacheIdentity(request())).toEqual({
      destination: "london ontario",
      days: 4,
      condition: "asthma_respiratory",
      medication: "albuterol",
    });
  });

  it("keys verification by destination, condition, and medication", () => {
    const base = buildSwarmCacheKey({
      destination: "London, Ontario",
      condition: "asthma_respiratory",
      medication: "albuterol",
    });
    expect(
      buildSwarmCacheKey({
        destination: "london ontario",
        condition: "asthma_respiratory",
        medication: "ALBUTEROL",
      }),
    ).toBe(base);
    expect(
      buildSwarmCacheKey({
        destination: "London, Ontario",
        condition: "cardiac_hypertension",
        medication: "albuterol",
      }),
    ).not.toBe(base);
  });
});
