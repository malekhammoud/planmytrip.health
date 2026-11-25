import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/travel-swarm/route";
import { closeDatabase, ensureSchema, resetDatabaseForTests } from "@/lib/db/postgres";
import { getCapture } from "@/lib/db/trips";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;
const runId = "swarm-run-1234";
const installId = "swarm-install-1234";

const body = {
  destination: "Lisbon, Portugal",
  condition: "asthma_respiratory" as const,
  runId,
  installId,
  captureConsent: true,
};

describeDb("swarm capture", () => {
  beforeAll(async () => {
    process.env.SWARM_MOCK = "1";
    process.env.SWARM_MOCK_SPEED = "50";
    process.env.PLANMYTRIP_CAPTURE_MOCK = "1";
    await ensureSchema();
    await resetDatabaseForTests();
  });

  afterAll(async () => {
    await closeDatabase();
    delete process.env.SWARM_MOCK;
    delete process.env.SWARM_MOCK_SPEED;
    delete process.env.PLANMYTRIP_CAPTURE_MOCK;
  });

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

    const row = await getCapture(runId);
    expect(row).not.toBeNull();
    const findings = Array.isArray(row?.swarm_json) ? row.swarm_json : [];
    expect(findings.length).toBe(1);
    expect(
      findings
        .map((finding) =>
          typeof finding === "object" && finding !== null && "worker" in finding
            ? String(finding.worker)
            : "",
        )
        .sort(),
    ).toEqual(["advisory"]);
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
    expect(await getCapture(otherRun)).toBeNull();
  });
});
