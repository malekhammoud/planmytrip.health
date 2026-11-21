import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/agent-plan/route";
import { closeDatabase, resetDatabaseForTests } from "@/lib/db/sqlite";
import { getCapture } from "@/lib/db/trips";

let directory = "";
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

beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "planmytrip-capture-"));
  process.env.PLANMYTRIP_DB_PATH = join(directory, "test.db");
  process.env.AGENT_MOCK = "1";
  process.env.PLANMYTRIP_CAPTURE_MOCK = "1";
  resetDatabaseForTests();
});

afterAll(() => {
  closeDatabase();
  delete process.env.PLANMYTRIP_DB_PATH;
  delete process.env.AGENT_MOCK;
  delete process.env.PLANMYTRIP_CAPTURE_MOCK;
  rmSync(directory, { recursive: true, force: true });
});

describe("planner capture", () => {
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

    const row = getCapture(runId);
    expect(row).not.toBeNull();
    const dose = JSON.parse(row?.dose_json ?? "[]") as Array<{ steps: number }>;
    expect(dose.length).toBe(4);
    expect(dose.every((day) => day.steps >= 0)).toBe(true);
    const features = JSON.parse(row?.features_json ?? "{}") as {
      peakExposure?: number;
    };
    expect(features.peakExposure).toBeGreaterThan(0);
    expect(row?.swarm_json).toBe("[]");
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
    expect(getCapture(otherRun)).toBeNull();
  });
});
