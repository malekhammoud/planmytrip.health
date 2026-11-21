import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MODEL_ARTIFACT } from "../model/artifact";
import type { TripDossier } from "../data/types";
import { closeDatabase, ensureSchema, resetDatabaseForTests } from "./postgres";
import {
  captureCounts,
  exportTrainingRows,
  getCapture,
  getStoredDose,
  listModelRuns,
  listTrips,
  recordModelRun,
  saveDossier,
  saveOutcome,
  saveSwarmFindings,
} from "./trips";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

function dossier(runId = "run-12345678"): TripDossier {
  return {
    schemaVersion: 1,
    runId,
    installId: "install-12345678",
    createdAt: "2026-11-21T10:00:00.000Z",
    request: {
      destination: "Lisbon, Portugal",
      days: 4,
      condition: "asthma_respiratory",
      medication: "albuterol inhaler",
      interests: "",
      budget: "balanced",
      hasSunLifeTravelCoverage: false,
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
      days: [
        {
          day: 1,
          steps: 2_000,
          walkingKm: 1,
          activeMinutes: 120,
          exertionWeightedMinutes: 180,
          recoveryMinutes: 30,
          stepCeiling: 3_150,
          walkingCapKm: 2.5,
          withinCaps: true,
          empty: false,
          source: "concierge",
        },
      ],
      degraded: false,
      mock: false,
    },
    verification: {
      research: [{ agentId: "culture", ok: true, summary: "Two visits." }],
      swarm: [],
    },
    features: {
      peakExposure: 0.6,
      recoveryCoverage: 0.8,
      tripLength: 4,
      adherence: null,
      heatFlag: 0,
      altitudeFlag: 0,
      baselineBurden: null,
    },
    consent: {
      capture: true,
      version: 1,
      at: "2026-11-21T10:00:00.000Z",
    },
  };
}

describeDb("trip capture storage", () => {
  beforeEach(async () => {
    await ensureSchema();
    await resetDatabaseForTests();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("saves a dossier, swarm findings, and an explicit outcome", async () => {
    await saveDossier(dossier());
    await saveSwarmFindings(
      "run-12345678",
      "install-12345678",
      [
        {
          worker: "advisory",
          ok: true,
          sourceUrl: "https://travel.gc.ca/travelling/advisories",
          retrievedAt: "2026-11-21T10:05:00.000Z",
          summary: "Exercise normal precautions.",
        },
      ],
      "2026-11-21T10:05:00.000Z",
    );
    expect(await getStoredDose("run-12345678")).toHaveLength(1);
    expect(
      await saveOutcome("run-12345678", "install-12345678", {
        flare: false,
        flareDay: null,
        severity: null,
        care: null,
        adherence: "same",
        notes: null,
        reportedAt: "2026-12-21T10:00:00.000Z",
      }),
    ).toBe(true);
    const row = await getCapture("run-12345678");
    expect(row?.label_flare).toBe(false);
    expect(row?.outcome_json).not.toBeNull();
  });

  it("keeps swarm findings when the planner dossier arrives later", async () => {
    await saveSwarmFindings(
      "run-12345678",
      "install-12345678",
      [
        {
          worker: "advisory",
          ok: true,
          sourceUrl: "https://travel.gc.ca/travelling/advisories",
          retrievedAt: "2026-11-21T10:05:00.000Z",
          summary: "Exercise normal precautions.",
        },
      ],
      "2026-11-21T10:05:00.000Z",
    );
    await saveDossier(dossier());
    const row = await getCapture("run-12345678");
    expect(Array.isArray(row?.swarm_json) ? row.swarm_json.length : 0).toBe(1);
    expect(await getStoredDose("run-12345678")).toHaveLength(1);
  });

  it("refuses an outcome from another install", async () => {
    await saveDossier(dossier());
    expect(
      await saveOutcome("run-12345678", "other-install", {
        flare: true,
        flareDay: 2,
        severity: "mild",
        care: "none",
        adherence: "same",
        notes: null,
        reportedAt: "2026-12-21T10:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("exports only labeled rows", async () => {
    await saveDossier(dossier());
    await saveOutcome("run-12345678", "install-12345678", {
      flare: false,
      flareDay: null,
      severity: null,
      care: null,
      adherence: "same",
      notes: null,
      reportedAt: "2026-12-21T10:00:00.000Z",
    });
    const rows = await exportTrainingRows();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const row = rows.find((entry) => entry.runId === "run-12345678");
    expect(row?.label).toBe(0);
    expect(row?.condition).toBe("asthma_respiratory");
    expect(Number.isFinite(row?.offset)).toBe(true);
  });

  it("lists trips and counts outcomes for one install", async () => {
    await saveDossier(dossier());
    await saveOutcome("run-12345678", "install-12345678", {
      flare: false,
      flareDay: null,
      severity: null,
      care: null,
      adherence: "same",
      notes: null,
      reportedAt: "2026-12-21T10:00:00.000Z",
    });
    const trips = await listTrips("install-12345678");
    expect(trips.some((trip) => trip.runId === "run-12345678")).toBe(true);
    const counts = await captureCounts();
    expect(counts.trips).toBeGreaterThanOrEqual(1);
    expect(counts.outcomes).toBeGreaterThanOrEqual(1);
  });

  it("records a model run for audit", async () => {
    await recordModelRun(MODEL_ARTIFACT);
    const runs = await listModelRuns();
    expect(
      runs.some((run) => run.modelVersion === MODEL_ARTIFACT.modelVersion),
    ).toBe(true);
  });
});
