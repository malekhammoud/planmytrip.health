/**
 * Route-level cache hit test: a known trip streams a complete plan without OpenCode.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/agent-plan/route";
import { resetCacheMemory } from "@/lib/cache/cacheStore";
import { writeCachedPlan } from "@/lib/cache/planCache";
import type { AgentTripPlan, PlannerRequest } from "@/lib/agent/agentTypes";

interface Frame {
  event: string;
  data: Record<string, unknown>;
}

function parseFrames(text: string): Frame[] {
  return text
    .split("\n\n")
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.startsWith("event:"))
    .map((chunk) => {
      const lines = chunk.split("\n");
      const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim() ?? "";
      const data = lines.find((line) => line.startsWith("data:"))?.slice(5).trim() ?? "{}";
      return { event, data: JSON.parse(data) as Record<string, unknown> };
    });
}

const request: PlannerRequest = {
  destination: "London, Ontario",
  origin: "",
  days: 4,
  condition: "asthma_respiratory",
  interests: "healthy vegan food",
  budget: "balanced",
  transport: "mixed",
  checkIn: "",
  travelers: 1,
  captureConsent: false,
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
    budget: { level: "balanced", estimatedTotal: null, currency: "CAD", notes: "" },
    sources: [],
    generatedAt: "2026-11-21T19:37:42.643Z",
  };
}

const previous = {
  memory: process.env.PLANMYTRIP_CACHE_MEMORY,
  database: process.env.DATABASE_URL,
  mock: process.env.AGENT_MOCK,
};

describe("POST /api/agent-plan cache hit", () => {
  beforeAll(async () => {
    process.env.PLANMYTRIP_CACHE_MEMORY = "1";
    delete process.env.DATABASE_URL;
    delete process.env.AGENT_MOCK;
    resetCacheMemory();
    await writeCachedPlan(
      request,
      {
        plan: plan(),
        research: [{ agentId: "stay", ok: true, summary: "4 verified stays" }],
        completed: ["stay"],
        failed: ["care"],
      },
      "2026-11-22T01:00:00.000Z",
    );
  });
  afterAll(() => {
    resetCacheMemory();
    if (previous.memory === undefined) delete process.env.PLANMYTRIP_CACHE_MEMORY;
    else process.env.PLANMYTRIP_CACHE_MEMORY = previous.memory;
    if (previous.database === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous.database;
    if (previous.mock === undefined) delete process.env.AGENT_MOCK;
    else process.env.AGENT_MOCK = previous.mock;
  });

  it("replays a complete plan with cached provenance and no live sessions", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/agent-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("x-plan-cache")).toBe("hit");
    const frames = parseFrames(await response.text());
    expect(frames[0]?.event).toBe("planner_started");
    expect(frames.at(-1)?.event).toBe("planner_done");
    expect(frames.some((frame) => frame.event === "agent_started")).toBe(false);
    expect(frames.some((frame) => frame.event === "agent_activity")).toBe(false);
    expect(frames.filter((frame) => frame.event === "agent_result")).toHaveLength(7);
    const ready = frames.find((frame) => frame.event === "plan_ready");
    expect(ready?.data).toMatchObject({
      cached: true,
      cachedAt: "2026-11-22T01:00:00.000Z",
      cacheMatch: "exact",
    });
    const cachedPlan = ready?.data.plan as { summary?: string } | undefined;
    expect(cachedPlan?.summary).toBe("A cached four-day London plan.");
  });

  it("does not replay a cached plan for another date or party", async () => {
    for (const override of [
      { checkIn: "2026-12-10", travelers: 2 },
      { checkIn: "", travelers: 2 },
      { checkIn: "2026-12-10", travelers: 1 },
    ]) {
      const response = await POST(
        new Request("http://localhost:3000/api/agent-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...request, ...override }),
        }),
      );
      // The exact key is different and the related fallback must refuse the date/party
      // mismatch. Without a database the live reservation fails closed.
      expect(response.status, JSON.stringify(override)).toBe(503);
      expect(response.headers.get("x-plan-cache")).toBeNull();
      await expect(response.json()).resolves.toMatchObject({
        code: "billing_unavailable",
      });
    }
  });
});
