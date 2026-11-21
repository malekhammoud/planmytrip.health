import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/travel-swarm/route";
import { closeDatabase, resetDatabaseForTests } from "@/lib/db/sqlite";
import { getCapture } from "@/lib/db/trips";

let directory = "";
const runId = "swarm-run-1234";
const installId = "swarm-install-1234";

const body = {
  destination: "Lisbon, Portugal",
  condition: "asthma_respiratory",
  medication: "albuterol",
  runId,
  installId,
  captureConsent: true,
};

beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "planmytrip-swarm-"));
  process.env.PLANMYTRIP_DB_PATH = join(directory, "test.db");
  process.env.SWARM_MOCK = "1";
  process.env.PLANMYTRIP_CAPTURE_MOCK = "1";
  resetDatabaseForTests();
});

afterAll(() => {
  closeDatabase();
  delete process.env.PLANMYTRIP_DB_PATH;
  delete process.env.SWARM_MOCK;
  delete process.env.PLANMYTRIP_CAPTURE_MOCK;
  rmSync(directory, { recursive: true, force: true });
});

describe("swarm capture", () => {
  it("stores consented worker findings on a stub row", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/travel-swarm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    expect(response.status).toBe(200);
    await response.text();

    const row = getCapture(runId);
    expect(row).not.toBeNull();
    const findings = JSON.parse(row?.swarm_json ?? "[]") as Array<{
      worker: string;
    }>;
    expect(findings.length).toBe(3);
    expect(findings.map((finding) => finding.worker).sort()).toEqual([
      "advisory",
      "coverage",
      "pharmacy",
    ]);
  });

  it("does not capture without consent", async () => {
    const otherRun = "swarm-run-5678";
    const response = await POST(
      new Request("http://localhost:3000/api/travel-swarm", {
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
