/**
 * PostgreSQL cache tests: exact and related planner reads plus verification reuse.
 * These tests skip when DATABASE_URL is absent.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDatabase, ensureSchema, resetDatabaseForTests } from "./postgres";
import { readCachedPlan, writeCachedPlan } from "@/lib/cache/planCache";
import { readCachedSwarm, writeCachedSwarm } from "@/lib/cache/swarmCache";
import { resetCacheMemory } from "@/lib/cache/cacheStore";
import { emptyFindings } from "@/lib/swarmGoals";
import { WORKER_IDS } from "@/lib/swarmTypes";
import type { AgentTripPlan, PlannerRequest } from "@/lib/agent/agentTypes";

const databaseUrl = process.env.DATABASE_URL;
const describeIfDatabase = databaseUrl === undefined ? describe.skip : describe;

const request: PlannerRequest = {
  destination: "Test Cache City",
  origin: "",
  days: 3,
  condition: "asthma_respiratory",
  medication: "albuterol",
  interests: "quiet food",
  budget: "balanced",
  transport: "mixed",
  checkIn: "",
  travelers: 1,
};

function plan(): AgentTripPlan {
  return {
    summary: "A cached test plan.",
    baseArea: "Centre",
    routeTheme: "Short walks",
    days: [
      {
        day: 1,
        title: "Arrival",
        area: "Centre",
        restDay: false,
        stepEstimate: 800,
        walkingKm: 0.4,
        recoveryMinutes: 30,
        blocks: [],
        stepCeiling: 3150,
        walkingCapKm: 1.8,
        withinCaps: true,
        checkpoint: "",
      },
    ],
    places: [],
    safetyNotes: [],
    bookingChecklist: [],
    budget: { level: "balanced", estimatedTotal: null, currency: "CAD", notes: "" },
    sources: [],
    generatedAt: "2026-11-21T19:37:42.643Z",
  };
}

describeIfDatabase("trip cache in PostgreSQL", () => {
  beforeAll(async () => {
    delete process.env.PLANMYTRIP_CACHE_MEMORY;
    await ensureSchema();
    await resetDatabaseForTests();
    resetCacheMemory();
  });
  afterAll(async () => {
    await closeDatabase();
  });

  it("reads an exact plan and a related preference fallback", async () => {
    await writeCachedPlan(
      request,
      {
        plan: plan(),
        research: [{ agentId: "stay", ok: true, summary: "3 stays" }],
        completed: ["stay"],
        failed: [],
      },
      "2026-11-22T01:00:00.000Z",
    );
    const exact = await readCachedPlan(request);
    expect(exact?.match).toBe("exact");
    expect(exact?.cachedAt).toBe("2026-11-22T01:00:00.000Z");

    resetCacheMemory();
    const related = await readCachedPlan({ ...request, interests: "vegan food" });
    expect(related?.match).toBe("related");
    expect(related?.plan.summary).toBe("A cached test plan.");
  });

  it("stores and reads a complete verification set", async () => {
    const values = Object.fromEntries(
      WORKER_IDS.map((worker) => [
        worker,
        {
          findings: emptyFindings(worker),
          sourceUrl: "https://example.com/source",
          retrievedAt: "2026-11-22T00:20:00.000Z",
          sources: [{ url: "https://example.com/source", title: "Source", api: "fetch" as const }],
          purposes: [{ purpose: "Read the page", tinyfishApi: "fetch" as const }],
        },
      ]),
    );
    await writeCachedSwarm(
      {
        destination: "Test Cache City",
        condition: "asthma_respiratory",
        medication: "albuterol",
      },
      WORKER_IDS,
      values,
      "2026-11-22T01:00:00.000Z",
    );
    resetCacheMemory();
    const cached = await readCachedSwarm(
      {
        destination: "test cache city",
        condition: "asthma_respiratory",
        medication: "albuterol",
      },
      ["advisory", "coverage"],
    );
    expect(cached?.workers.advisory).toBeDefined();
    expect(cached?.workers.coverage).toBeDefined();
    expect(cached?.workers.pharmacy).toBeUndefined();
  });
});
