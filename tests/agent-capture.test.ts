import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/agent-plan/route";
import { closeDatabase, ensureSchema, resetDatabaseForTests } from "@/lib/db/postgres";
import { getCapture } from "@/lib/db/trips";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;
const runId = "capture-run-1234";
const installId = "capture-install-1234";

const body = {
  destination: "Lisbon, Portugal",
  days: 4,
  condition: "asthma_respiratory",
  medication: "albuterol",
  interests: "quiet food",
  budget: "balanced",
  runId,
  installId,
  captureConsent: true,
  hasSunLifeTravelCoverage: false,
};

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
});
