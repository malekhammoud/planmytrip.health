/**
 * Cached event replay tests: ordering, provenance, and terminal frames.
 */

import { describe, expect, it } from "vitest";
import { buildCachedPlannerEvents, buildCachedSwarmEvents } from "./cachedEvents";
import type { CachedPlan } from "./planCache";
import type { CachedSwarm } from "./swarmCache";
import { emptyFindings } from "@/lib/swarmGoals";
import { WORKER_IDS } from "@/lib/swarmTypes";
import type { AgentTripPlan } from "@/lib/agent/agentTypes";

const now = "2026-11-22T01:00:00.000Z";

function plan(): AgentTripPlan {
  return {
    summary: "Cached London plan",
    baseArea: "Downtown",
    routeTheme: "Short walks",
    days: [
      {
        day: 1,
        title: "Arrival",
        area: "Downtown",
        restDay: false,
        stepEstimate: 100,
        walkingKm: 0,
        recoveryMinutes: 30,
        blocks: [],
        stepCeiling: 1000,
        walkingCapKm: 1,
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

const cachedPlan: CachedPlan = {
  plan: plan(),
  research: [
    { agentId: "stay", ok: true, summary: "4 stays" },
    { agentId: "concierge", ok: true, summary: "Route ready" },
  ],
  completed: ["stay", "concierge"],
  failed: ["care"],
  cachedAt: "2026-11-22T00:30:00.000Z",
  match: "exact",
  signature: {
    destination: "london ontario",
    days: 4,
    condition: "asthma_respiratory",
    interests: "healthy vegan food",
    budget: "balanced",
    transport: "mixed",
    checkIn: "",
    travelers: 1,
  },
};

const cachedSwarm: CachedSwarm = {
  cachedAt: "2026-11-22T00:30:00.000Z",
  workers: Object.fromEntries(
    WORKER_IDS.map((worker) => [
      worker,
      {
        findings: emptyFindings(worker),
        sourceUrl: "https://example.com",
        retrievedAt: "2026-11-22T00:20:00.000Z",
        sources: [{ url: "https://example.com", title: "Source", api: "fetch" as const }],
        purposes: [{ purpose: "Read the page", tinyfishApi: "fetch" as const }],
      },
    ]),
  ),
};

describe("cached planner events", () => {
  it("starts, reports all seven, and ends with planner_done", () => {
    const events = buildCachedPlannerEvents(cachedPlan, now);
    expect(events[0]?.event).toBe("planner_started");
    expect(events.filter((event) => event.event === "agent_result")).toHaveLength(7);
    expect(events.at(-1)?.event).toBe("planner_done");
    const ready = events.find((event) => event.event === "plan_ready");
    expect(ready?.data).toMatchObject({
      cached: true,
      cachedAt: "2026-11-22T00:30:00.000Z",
      cacheMatch: "exact",
      completed: ["stay", "concierge"],
      failed: ["care"],
    });
    expect(
      events.every(
        (event) =>
          !("cached" in event.data) || event.data.cached === true,
      ),
    ).toBe(true);
  });
});

describe("cached swarm events", () => {
  it("replays real purposes, sources, findings, and ends with swarm_done", () => {
    const events = buildCachedSwarmEvents(cachedSwarm, WORKER_IDS, now);
    expect(events.filter((event) => event.event === "worker_complete")).toHaveLength(1);
    expect(events.filter((event) => event.event === "worker_progress")).toHaveLength(1);
    expect(events.filter((event) => event.event === "worker_sources")).toHaveLength(1);
    const done = events.at(-1);
    expect(done?.event).toBe("swarm_done");
    expect(done?.data).toMatchObject({
      cached: true,
      cachedAt: "2026-11-22T00:30:00.000Z",
      completed: [...WORKER_IDS],
      failed: [],
      summary: { steps: 1, sources: 1, findings: 1, unknownEvents: 0 },
    });
  });
});
