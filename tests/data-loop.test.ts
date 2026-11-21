/**
 * End-to-end proof of the consented data loop against PostgreSQL.
 *
 * Saves labeled, non-mock dossiers exactly as the capture path would, exports only the
 * explicit labels, trains the shipped pipeline, gates the evidence tier, and predicts.
 * Skipped when DATABASE_URL is absent, like the other database suites.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Condition } from "@/lib/types";
import { ENGINE_VERSION } from "@/lib/data/types";
import type {
  AdherenceLevel,
  PlannedDose,
  TripDossier,
} from "@/lib/data/types";
import { V0_FEATURES } from "@/lib/model/types";
import { tierFor, predictFromArtifact } from "@/lib/model/predict";
import { trainModel } from "@/lib/model/train";
import { closeDatabase, ensureSchema, resetDatabaseForTests } from "@/lib/db/postgres";
import { exportTrainingRows, saveDossier, saveOutcome } from "@/lib/db/trips";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;
const CONDITIONS: readonly Condition[] = [
  "asthma_respiratory",
  "chronic_fatigue_pots",
  "pregnancy_second_trimester",
  "severe_food_allergy",
  "cardiac_hypertension",
];
const ADHERENCE: readonly AdherenceLevel[] = ["less", "same", "more"];
const COUNT = 60;

function dose(steps: number, walkingKm: number): PlannedDose {
  return {
    day: 1,
    steps,
    walkingKm,
    activeMinutes: 120,
    exertionWeightedMinutes: 180,
    recoveryMinutes: 45,
    stepCeiling: 7_000,
    walkingCapKm: 4,
    withinCaps: true,
    empty: false,
    source: "concierge",
  };
}

function dossier(index: number): TripDossier {
  const condition = CONDITIONS[index % CONDITIONS.length];
  const peak = 0.25 + (index % 10) * 0.07;
  const recovery = 0.45 + (index % 6) * 0.09;
  const days = 2 + (index % 6);
  return {
    schemaVersion: 1,
    runId: `loop-run-${index.toString().padStart(4, "0")}`,
    installId: `loop-install-${index % 20}`,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    request: {
      destination: "Lisbon, Portugal",
      days,
      condition,
      medication: "listed medication",
      interests: "",
      budget: "balanced",
      hasSunLifeTravelCoverage: false,
    },
    engine: {
      healthSafetyScore: 45 + (index % 9) * 5,
      baselineScore: 40,
      riskReductionPct: 30,
      dailyStepCeiling: 7_000,
      dose: [],
    },
    plan: {
      source: "concierge",
      days: [dose(Math.round(peak * 7_000), Math.round(peak * 40) / 10)],
      degraded: false,
      mock: false,
    },
    verification: { research: [], swarm: [] },
    features: {
      peakExposure: peak,
      recoveryCoverage: recovery,
      tripLength: days,
      adherence: null,
      heatFlag: 0,
      altitudeFlag: 0,
      baselineBurden: null,
    },
    consent: {
      capture: true,
      version: 1,
      at: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    },
  };
}

describeDb("consented data loop", () => {
  beforeAll(async () => {
    await ensureSchema();
    await resetDatabaseForTests();
    for (let index = 0; index < COUNT; index += 1) {
      const record = dossier(index);
      await saveDossier(record);
      const flare = index % 3 === 0;
      await saveOutcome(record.runId, record.installId, {
        flare,
        flareDay: flare ? 1 + (index % record.request.days) : null,
        severity: flare ? (index % 2 === 0 ? "mild" : "moderate") : null,
        care: flare ? "none" : null,
        adherence: ADHERENCE[index % ADHERENCE.length],
        notes: null,
        reportedAt: "2026-02-01T00:00:00.000Z",
      });
    }
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("exports exactly the explicit labels, grouped by install", async () => {
    const rows = await exportTrainingRows();
    expect(rows).toHaveLength(COUNT);
    expect(rows.every((row) => row.label === 0 || row.label === 1)).toBe(true);
    const users = new Set(rows.map((row) => row.userId));
    expect(users.size).toBe(20);
    expect(rows.filter((row) => row.label === 1)).toHaveLength(20);
    expect(rows.every((row) => Number.isFinite(row.offset))).toBe(true);
  });

  it("trains the shipped pipeline on those rows and gates the tier", async () => {
    const rows = await exportTrainingRows();
    const artifact = trainModel(rows, {
      featureNames: [...V0_FEATURES],
      folds: 5,
      source: "outcomes",
      modelVersion: "loop-test",
      trainedAt: "2026-02-01T00:00:00.000Z",
      engineVersion: ENGINE_VERSION,
      dataHash: "loop-test",
    });
    expect(artifact.training.n).toBe(COUNT);
    expect(artifact.training.events).toBe(20);
    expect(artifact.source).toBe("outcomes");
    expect(artifact.calibration.length).toBeGreaterThan(0);
    expect(Number.isFinite(artifact.metrics.brier)).toBe(true);
    expect(artifact.metrics.ece).toBeGreaterThanOrEqual(0);
    // 60 labels cross the 50-label pooled threshold but no condition reaches 200.
    expect(tierFor(artifact, "asthma_respiratory")).toBe("pooled");
    const prediction = predictFromArtifact(
      artifact,
      rows[0].features,
      70,
      rows[0].condition,
    );
    expect(prediction.tier).toBe("pooled");
    expect(Number.isFinite(prediction.pFlare)).toBe(true);
    expect(prediction.interval[0]).toBeLessThanOrEqual(prediction.pFlare);
    expect(prediction.interval[1]).toBeGreaterThanOrEqual(prediction.pFlare);
  });
});
