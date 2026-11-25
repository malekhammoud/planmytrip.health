import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as postOutcome } from "@/app/api/trips/outcome/route";
import type { TripDossier } from "@/lib/data/types";
import { closeDatabase, ensureSchema, resetDatabaseForTests } from "@/lib/db/postgres";
import { getCapture, saveDossier } from "@/lib/db/trips";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;
const runId = "outcome-run-1234";
const installId = "outcome-install-1234";

const dossier: TripDossier = {
  schemaVersion: 1,
  runId,
  installId,
  createdAt: "2026-11-21T10:00:00.000Z",
  request: {
    destination: "Lisbon, Portugal",
    days: 4,
    condition: "asthma_respiratory",
    interests: "",
    budget: "balanced",
  },
  engine: {
    healthSafetyScore: 75,
    baselineScore: 50,
    riskReductionPct: 50,
    dailyStepCeiling: 7_000,
    dose: [],
  },
  plan: {
    source: "concierge",
    days: [],
    degraded: false,
    mock: false,
  },
  verification: { research: [], swarm: [] },
  features: {
    peakExposure: 0.6,
    recoveryCoverage: 0.8,
    tripLength: 4,
    adherence: null,
    heatFlag: 0,
    altitudeFlag: 0,
    baselineBurden: null,
  },
  consent: { capture: true, version: 1, at: "2026-11-21T10:00:00.000Z" },
};

function outcomeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/trips/outcome", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describeDb("trip outcome routes", () => {
  beforeAll(async () => {
    await ensureSchema();
    await resetDatabaseForTests();
    await saveDossier(dossier);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("stores an explicit positive label", async () => {
    const response = await postOutcome(
      outcomeRequest({
        runId,
        installId,
        outcome: {
          flare: true,
          flareDay: 3,
          severity: "moderate",
          care: "clinic",
          adherence: "less",
          notes: null,
        },
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    const row = await getCapture(runId);
    expect(row?.label_flare).toBe(true);
    expect(row?.label_severity).toBe("moderate");
    expect(row?.label_care).toBe("clinic");
  });

  it("refuses an outcome from another install", async () => {
    const response = await postOutcome(
      outcomeRequest({
        runId,
        installId: "other-install-1234",
        outcome: { flare: false, adherence: "same" },
      }),
    );
    expect(response.status).toBe(404);
  });

  it("requires an explicit flare answer", async () => {
    const response = await postOutcome(
      outcomeRequest({
        runId,
        installId,
        outcome: { adherence: "same" },
      }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects a malformed body", async () => {
    const response = await postOutcome(
      new Request("http://localhost:3000/api/trips/outcome", {
        method: "POST",
        body: "not json",
      }),
    );
    expect(response.status).toBe(400);
  });

});
