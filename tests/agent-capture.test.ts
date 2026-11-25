import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/agent-plan/route";
import { writeCachedPlan } from "@/lib/cache/planCache";
import type { AgentTripPlan, PlannerRequest } from "@/lib/agent/agentTypes";
import { closeDatabase, ensureSchema, resetDatabaseForTests } from "@/lib/db/postgres";
import { getCapture } from "@/lib/db/trips";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;
const runId = "capture-run-1234";
const installId = "capture-install-1234";

const body = {
  destination: "Lisbon, Portugal",
  days: 4,
  condition: "asthma_respiratory",
  interests: "quiet food",
  budget: "balanced",
  runId,
  installId,
  captureConsent: true,
};

function cachedPlan(): AgentTripPlan {
  return {
    summary: "A cached London plan.",
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

describeDb("planner capture", () => {
  beforeAll(async () => {
    process.env.AGENT_MOCK = "1";
    process.env.PLANMYTRIP_CAPTURE_MOCK = "1";
    await ensureSchema();
    await resetDatabaseForTests();
  });

  afterAll(async () => {
    await closeDatabase();
    delete process.env.AGENT_MOCK;
    delete process.env.PLANMYTRIP_CAPTURE_MOCK;
  });

  it("stores a consented mock run with a computed dose and features", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/agent-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    expect(response.status).toBe(200);
    await response.text();

    const row = await getCapture(runId);
    expect(row).not.toBeNull();
    const dose = Array.isArray(row?.dose_json) ? row.dose_json : [];
    expect(dose.length).toBe(4);
    expect(
      dose.every(
        (day) =>
          typeof day === "object" &&
          day !== null &&
          "steps" in day &&
          typeof day.steps === "number" &&
          day.steps >= 0,
      ),
    ).toBe(true);
    const features =
      typeof row?.features_json === "object" && row.features_json !== null
        ? row.features_json
        : {};
    expect(
      "peakExposure" in features && typeof features.peakExposure === "number"
        ? features.peakExposure
        : 0,
    ).toBeGreaterThan(0);
    expect(row?.swarm_json).toEqual([]);
  });

  it("does not capture without consent", async () => {
    const otherRun = "capture-run-5678";
    const response = await POST(
      new Request("http://localhost:3000/api/agent-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          runId: otherRun,
          captureConsent: false,
        }),
      }),
    );
    expect(response.status).toBe(200);
    await response.text();
    expect(await getCapture(otherRun)).toBeNull();
  });

  it("does not capture a cached plan replay", async () => {
    const cachedRun = "cached-run-1234";
    const cachedRequest: PlannerRequest = {
      destination: "Kingston, Ontario",
      origin: "",
      days: 4,
      condition: "asthma_respiratory",
      interests: "quiet food",
      budget: "balanced",
      transport: "mixed",
      checkIn: "2026-12-10",
      travelers: 2,
      runId: cachedRun,
      installId,
      captureConsent: true,
    };
    await writeCachedPlan(
      cachedRequest,
      {
        plan: cachedPlan(),
        research: [],
        completed: ["stay"],
        failed: [],
      },
      "2026-11-22T01:00:00.000Z",
    );

    const previousMock = process.env.AGENT_MOCK;
    const previousDisabled = process.env.PLANMYTRIP_LIVE_DISABLED;
    delete process.env.AGENT_MOCK;
    process.env.PLANMYTRIP_LIVE_DISABLED = "1";
    try {
      const response = await POST(
        new Request("http://localhost:3000/api/agent-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cachedRequest),
        }),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("x-plan-cache")).toBe("hit");
      await response.text();
      expect(await getCapture(cachedRun)).toBeNull();
    } finally {
      if (previousMock === undefined) delete process.env.AGENT_MOCK;
      else process.env.AGENT_MOCK = previousMock;
      if (previousDisabled === undefined) {
        delete process.env.PLANMYTRIP_LIVE_DISABLED;
      } else {
        process.env.PLANMYTRIP_LIVE_DISABLED = previousDisabled;
      }
    }
  });
});
