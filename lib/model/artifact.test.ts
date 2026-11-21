/**
 * Production guards for the model artifact and inference contract.
 *
 * These tests defend the boundary between a demo artifact and a live estimate: a
 * truncated file, an unknown feature, a stale engine version, or a zero-row artifact
 * must all resolve to the deterministic engine rather than a learned probability.
 */

import { describe, expect, it } from "vitest";
import type { Condition } from "../types";
import type { TrainingRow, TripFeatures } from "../data/types";
import { ENGINE_VERSION } from "../data/types";
import { MODEL_ARTIFACT, MODEL_AVAILABLE, parseArtifact } from "./artifact";
import { engineOffset } from "./features";
import { predictFromArtifact, riskCurve, tierFor } from "./predict";
import { trainModel } from "./train";
import { MODEL_PIPELINE_VERSION, V0_FEATURES, type ModelArtifact } from "./types";

const CONDITIONS: readonly Condition[] = [
  "asthma_respiratory",
  "chronic_fatigue_pots",
  "pregnancy_second_trimester",
  "severe_food_allergy",
  "cardiac_hypertension",
];

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function features(peak: number, recovery: number, days: number): TripFeatures {
  return {
    peakExposure: peak,
    recoveryCoverage: recovery,
    tripLength: days,
    adherence: null,
    heatFlag: 0,
    altitudeFlag: 0,
    baselineBurden: null,
  };
}

function rows(count = 240): TrainingRow[] {
  const random = mulberry32(11);
  const result: TrainingRow[] = [];
  for (let index = 0; index < count; index += 1) {
    const peak = 0.25 + random() * 0.7;
    const recovery = 0.4 + random() * 0.6;
    const days = 2 + Math.floor(random() * 6);
    const offset = engineOffset(55 + Math.floor(random() * 35));
    const linear =
      offset + 1.6 * (peak - 0.55) - 1.1 * (recovery - 0.8);
    result.push({
      runId: `run-${index}`,
      userId: `user-${index % 30}`,
      condition: CONDITIONS[index % CONDITIONS.length],
      features: features(peak, recovery, days),
      offset,
      label: random() < 1 / (1 + Math.exp(-linear)) ? 1 : 0,
      days,
    });
  }
  return result;
}

function trained(): ModelArtifact {
  return trainModel(rows(), {
    featureNames: [...V0_FEATURES],
    folds: 5,
    source: "outcomes",
    modelVersion: "test-pipeline-2",
    trainedAt: "2026-11-21T00:00:00.000Z",
    engineVersion: ENGINE_VERSION,
    dataHash: "test",
  });
}

function jsonClone(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

describe("parseArtifact", () => {
  it("accepts the committed artifact on the current pipeline", () => {
    expect(MODEL_AVAILABLE).toBe(true);
    expect(MODEL_ARTIFACT.pipelineVersion).toBe(MODEL_PIPELINE_VERSION);
    expect(MODEL_ARTIFACT.source).toBe("synthetic");
    expect(MODEL_ARTIFACT.training.n).toBeGreaterThan(0);
    expect(MODEL_ARTIFACT.calibration.length).toBeGreaterThan(0);
  });

  it("round-trips a trained artifact through JSON", () => {
    const source = trained();
    const parsed = parseArtifact(jsonClone(source));
    expect(parsed).not.toBeNull();
    expect(parsed?.coefficients).toEqual(source.coefficients);
    expect(parsed?.calibration).toEqual(source.calibration);
    expect(parsed?.pipelineVersion).toBe(MODEL_PIPELINE_VERSION);
  });

  it("rejects a different pipeline, engine, or schema version", () => {
    const source = jsonClone(trained()) as Record<string, unknown>;
    expect(parseArtifact({ ...source, pipelineVersion: 1 })).toBeNull();
    expect(parseArtifact({ ...source, schemaVersion: 2 })).toBeNull();
  });

  it("rejects malformed feature, coefficient, covariance, and calibration shapes", () => {
    const base = jsonClone(trained()) as Record<string, unknown>;

    expect(
      parseArtifact({ ...base, featureNames: ["notAFeature"] }),
    ).toBeNull();
    expect(
      parseArtifact({ ...base, featureNames: ["peakExposure", "peakExposure"] }),
    ).toBeNull();

    const coefficients = { ...(base.coefficients as Record<string, unknown>) };
    delete coefficients.peakExposure;
    expect(parseArtifact({ ...base, coefficients })).toBeNull();

    const stats = jsonClone(base.featureStats) as Record<string, unknown>;
    (stats.peakExposure as Record<string, unknown>).std = 0;
    expect(parseArtifact({ ...base, featureStats: stats })).toBeNull();

    const covariance = jsonClone(base.covariance) as number[][];
    covariance.pop();
    expect(parseArtifact({ ...base, covariance })).toBeNull();

    expect(parseArtifact({ ...base, calibration: [] })).toBeNull();
    expect(
      parseArtifact({
        ...base,
        calibration: [
          { x: 0.2, y: 0.5 },
          { x: 0.4, y: 0.2 },
        ],
      }),
    ).toBeNull();
  });

  it("rejects missing condition counts and non-finite metrics", () => {
    const base = jsonClone(trained()) as Record<string, unknown>;
    const training = jsonClone(base.training) as Record<string, unknown>;
    const byCondition = training.byCondition as Record<string, unknown>;
    delete byCondition.asthma_respiratory;
    expect(parseArtifact({ ...base, training })).toBeNull();

    const metrics = { ...(base.metrics as Record<string, unknown>), brier: Number.NaN };
    expect(parseArtifact({ ...base, metrics })).toBeNull();

    const mismatched = {
      ...(base.metrics as Record<string, unknown>),
      n: 999,
    };
    expect(parseArtifact({ ...base, metrics: mismatched })).toBeNull();
  });

  it("rejects a missing or invalid timestamp and a non-object payload", () => {
    const base = jsonClone(trained()) as Record<string, unknown>;
    expect(parseArtifact(null)).toBeNull();
    expect(parseArtifact([])).toBeNull();
    expect(parseArtifact("{}")).toBeNull();
    expect(parseArtifact({ ...base, trainedAt: "not a date" })).toBeNull();
  });
});

describe("tierFor", () => {
  it("never lets a synthetic artifact drive a live estimate", () => {
    const outcomes = { ...trained(), source: "outcomes" as const };
    expect(tierFor(outcomes, "asthma_respiratory")).toBe("pooled");
    expect(
      tierFor({ ...outcomes, source: "synthetic" }, "asthma_respiratory"),
    ).toBe("synthetic");
  });

  it("falls back to the engine below 50 real labels", () => {
    const source = trained();
    const small = { ...source, training: { ...source.training, n: 20 } };
    expect(tierFor(small, "asthma_respiratory")).toBe("engine");
  });

  it("uses pooled and condition tiers above their thresholds", () => {
    const source = trained();
    const pooled = { ...source, training: { ...source.training, n: 80 } };
    expect(tierFor(pooled, "asthma_respiratory")).toBe("pooled");
    const condition = {
      ...source,
      training: {
        ...source.training,
        n: 300,
        byCondition: {
          ...source.training.byCondition,
          asthma_respiratory: { n: 220, events: 30 },
        },
      },
    };
    expect(tierFor(condition, "asthma_respiratory")).toBe("condition");
  });

  it("treats a zero-row artifact as the engine, not a learned model", () => {
    const empty = trained();
    const zero = {
      ...empty,
      training: { ...empty.training, n: 0, events: 0 },
    };
    expect(tierFor(zero, "asthma_respiratory")).toBe("engine");
    const prediction = predictFromArtifact(
      zero,
      features(0.9, 0.2, 6),
      72,
      "asthma_respiratory",
    );
    expect(prediction.tier).toBe("engine");
    expect(prediction.pFlare).toBeCloseTo(0.28, 6);
    expect(prediction.interval).toEqual([prediction.pFlare, prediction.pFlare]);
  });

  it("refuses an artifact trained for another engine version", () => {
    const stale = { ...trained(), engineVersion: "0" };
    expect(tierFor(stale, "asthma_respiratory")).toBe("engine");
    const prediction = predictFromArtifact(
      stale,
      features(0.7, 0.5, 4),
      80,
      "asthma_respiratory",
    );
    expect(prediction.tier).toBe("engine");
    expect(prediction.pFlare).toBeCloseTo(0.2, 6);
  });
});

describe("predictFromArtifact", () => {
  it("returns a bounded, ordered interval and a finite probability", () => {
    const prediction = predictFromArtifact(
      trained(),
      features(0.7, 0.5, 4),
      72,
      "asthma_respiratory",
    );
    expect(Number.isFinite(prediction.pFlare)).toBe(true);
    expect(prediction.pFlare).toBeGreaterThanOrEqual(0.005);
    expect(prediction.pFlare).toBeLessThanOrEqual(0.995);
    expect(prediction.interval[0]).toBeLessThanOrEqual(prediction.pFlare);
    expect(prediction.interval[1]).toBeGreaterThanOrEqual(prediction.pFlare);
    expect(prediction.interval[0]).toBeGreaterThanOrEqual(0.005);
    expect(prediction.interval[1]).toBeLessThanOrEqual(0.995);
    expect(prediction.n).toBe(240);
  });

  it("reproduces the engine exactly when every coefficient is zero", () => {
    const source = trained();
    const coeff = source.coefficients;
    const zeroed: ModelArtifact = {
      ...source,
      coefficients: {
        intercept: 0,
        ...Object.fromEntries(Object.keys(coeff).filter((key) => key !== "intercept").map((key) => [key, 0])),
      },
      calibration: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    };
    const score = 63;
    const prediction = predictFromArtifact(
      zeroed,
      features(0.8, 0.3, 5),
      score,
      "asthma_respiratory",
    );
    expect(prediction.pFlare).toBeCloseTo((100 - score) / 100, 6);
  });

  it("is monotone in peak exposure at the synthetic tier", () => {
    const artifact = MODEL_ARTIFACT;
    const curve = riskCurve(
      artifact,
      features(0.6, 0.8, 4),
      70,
      "asthma_respiratory",
      0.2,
      1.2,
      11,
    );
    for (let index = 1; index < curve.length; index += 1) {
      expect(curve[index].pFlare).toBeGreaterThanOrEqual(
        curve[index - 1].pFlare - 1e-12,
      );
      expect(Number.isFinite(curve[index].pFlare)).toBe(true);
    }
  });
});
