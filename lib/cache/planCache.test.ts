/**
 * Planner cache tests against the in-process tier.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { writeCachedPlan, readCachedPlan, type PlanCacheWrite } from "./planCache";
import { resetCacheMemory } from "./cacheStore";
import type { AgentTripPlan, PlannerRequest } from "@/lib/agent/agentTypes";

const previousMemory = process.env.PLANMYTRIP_CACHE_MEMORY;
const previousDatabase = process.env.DATABASE_URL;

const request: PlannerRequest = {
  destination: "London, Ontario",
  origin: "",
  days: 4,
  condition: "asthma_respiratory",
  medication: "albuterol",
  interests: "healthy vegan food",
  budget: "balanced",
  transport: "mixed",
};

function plan(): AgentTripPlan {
  return {
    summary: "A cached four-day London plan.",
    baseArea: "Downtown",
    routeTheme: "Short walks",
    days: [
      {
        day: 1,
        title: "Arrival",
        area: "Downtown",
        restDay: false,
        stepEstimate: 1200,
        walkingKm: 0.9,
        recoveryMinutes: 30,
        blocks: [],
        stepCeiling: 3150,
        walkingCapKm: 1.8,
        withinCaps: true,
        checkpoint: "Rest after lunch.",
      },
    ],
    places: [],
    safetyNotes: [],
    bookingChecklist: [],
    budget: {
      level: "balanced",
      estimatedTotal: null,
      currency: "CAD",
      notes: "",
    },
    sources: [],
    generatedAt: "2026-11-21T19:37:42.643Z",
  };
}

function write(overrides: Partial<PlanCacheWrite> = {}): PlanCacheWrite {
  return {
    plan: plan(),
    research: [
      { agentId: "stay", ok: true, summary: "4 verified stays" },
      { agentId: "concierge", ok: true, summary: "Route ready" },
    ],
    completed: ["stay", "concierge"],
    failed: [],
    ...overrides,
  };
}

describe("planner cache", () => {
  beforeAll(() => {
    process.env.PLANMYTRIP_CACHE_MEMORY = "1";
    delete process.env.DATABASE_URL;
  });
  afterAll(() => {
    if (previousMemory === undefined) delete process.env.PLANMYTRIP_CACHE_MEMORY;
    else process.env.PLANMYTRIP_CACHE_MEMORY = previousMemory;
    if (previousDatabase === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabase;
  });
  beforeEach(() => resetCacheMemory());

  it("reads back an exact plan with its provenance", async () => {
    await writeCachedPlan(request, write(), "2026-11-22T01:00:00.000Z");
    const cached = await readCachedPlan(request);
    expect(cached).not.toBeNull();
    expect(cached?.match).toBe("exact");
    expect(cached?.cachedAt).toBe("2026-11-22T01:00:00.000Z");
    expect(cached?.plan.summary).toBe("A cached four-day London plan.");
    expect(cached?.research.map((entry) => entry.agentId)).toEqual([
      "stay",
      "concierge",
    ]);
  });

  it("ignores a normalized equivalent request's formatting", async () => {
    await writeCachedPlan(request, write(), "2026-11-22T01:00:00.000Z");
    const cached = await readCachedPlan({
      ...request,
      destination: "  london ONTARIO ",
      medication: "ALBUTEROL",
    });
    expect(cached?.match).toBe("exact");
  });

  it("does not store a mock or empty plan", async () => {
    await writeCachedPlan(
      request,
      write({ plan: { ...plan(), mock: true } }),
      "2026-11-22T01:00:00.000Z",
    );
    expect(await readCachedPlan(request)).toBeNull();

    await writeCachedPlan(
      request,
      write({ plan: { ...plan(), days: [] } }),
      "2026-11-22T01:00:00.000Z",
    );
    expect(await readCachedPlan(request)).toBeNull();
  });

  it("expires a plan after its window", async () => {
    await writeCachedPlan(request, write(), "2020-01-01T00:00:00.000Z");
    expect(await readCachedPlan(request)).toBeNull();
  });
});
