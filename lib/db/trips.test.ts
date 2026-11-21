import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MODEL_ARTIFACT } from "../model/artifact";
import type { TripDossier } from "../data/types";
import { closeDatabase, resetDatabaseForTests } from "./sqlite";
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

let directory = "";

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

beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "planmytrip-db-"));
  process.env.PLANMYTRIP_DB_PATH = join(directory, "test.db");
  resetDatabaseForTests();
});

afterAll(() => {
  closeDatabase();
  delete process.env.PLANMYTRIP_DB_PATH;
  rmSync(directory, { recursive: true, force: true });
});

describe("trip capture storage", () => {
  it("saves a dossier, swarm findings, and an explicit outcome", () => {
    saveDossier(dossier());
    saveSwarmFindings(
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
    expect(getStoredDose("run-12345678")).toHaveLength(1);
    expect(
      saveOutcome("run-12345678", "install-12345678", {
        flare: false,
        flareDay: null,
        severity: null,
        care: null,
        adherence: "same",
        notes: null,
        reportedAt: "2026-12-21T10:00:00.000Z",
      }),
    ).toBe(true);
    const row = getCapture("run-12345678");
    expect(row?.label_flare).toBe(0);
    expect(row?.outcome_json).not.toBeNull();
  });

  it("refuses an outcome from another install", () => {
    expect(
      saveOutcome("run-12345678", "other-install", {
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

  it("exports only labeled rows", () => {
    const rows = exportTrainingRows();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const row = rows.find((entry) => entry.runId === "run-12345678");
    expect(row?.label).toBe(0);
    expect(row?.condition).toBe("asthma_respiratory");
    expect(Number.isFinite(row?.offset)).toBe(true);
  });

  it("lists trips and counts outcomes for one install", () => {
    const trips = listTrips("install-12345678");
    expect(trips.some((trip) => trip.runId === "run-12345678")).toBe(true);
    expect(captureCounts().trips).toBeGreaterThanOrEqual(1);
    expect(captureCounts().outcomes).toBeGreaterThanOrEqual(1);
  });

  it("records a model run for audit", () => {
    recordModelRun(MODEL_ARTIFACT);
    const runs = listModelRuns();
    expect(runs.some((run) => run.modelVersion === MODEL_ARTIFACT.modelVersion)).toBe(
      true,
    );
  });
});
