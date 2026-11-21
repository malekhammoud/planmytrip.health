import { describe, expect, it } from "vitest";
import type { TrainingRow, TripFeatures } from "../data/types";
import { engineOffset } from "./features";
import { predictFromArtifact, riskCurve, tierFor } from "./predict";
import { foldIndexFor, trainModel } from "./train";
import {
  MODEL_PIPELINE_VERSION,
  V0_FEATURES,
  type ModelArtifact,
} from "./types";
import type { Condition } from "../types";

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

const CONDITIONS: readonly Condition[] = [
  "asthma_respiratory",
  "chronic_fatigue_pots",
  "pregnancy_second_trimester",
  "severe_food_allergy",
  "cardiac_hypertension",
];

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

function syntheticRows(count: number): TrainingRow[] {
  const random = mulberry32(7);
  const rows: TrainingRow[] = [];
  for (let index = 0; index < count; index += 1) {
    const peak = 0.25 + random() * 0.7;
    const recovery = 0.4 + random() * 0.6;
    const days = 2 + Math.floor(random() * 6);
    const score = 55 + Math.floor(random() * 35);
    const offset = engineOffset(score);
    const linear =
      offset +
      1.6 * (peak - 0.55) -
      1.1 * (recovery - 0.8) +
      0.15 * ((days - 4) / 1.5);
    const label = random() < 1 / (1 + Math.exp(-linear)) ? 1 : 0;
    rows.push({
      runId: `run-${index}`,
      userId: `user-${index % 40}`,
      condition: CONDITIONS[index % CONDITIONS.length],
      features: features(peak, recovery, days),
      offset,
      label,
      days,
    });
  }
  return rows;
}

function artifact(overrides: Partial<ModelArtifact> = {}): ModelArtifact {
  const base = trainModel(syntheticRows(600), {
    featureNames: [...V0_FEATURES],
    folds: 5,
    source: "synthetic",
    modelVersion: "test-1",
    trainedAt: "2026-11-21T00:00:00.000Z",
    engineVersion: "1",
    dataHash: "test",
  });
  return { ...base, ...overrides };
}

describe("trainModel", () => {
  it("produces a finite artifact with an improving Brier score", () => {
    const trained = artifact();
    expect(trained.featureNames).toEqual([...V0_FEATURES]);
    expect(trained.pipelineVersion).toBe(MODEL_PIPELINE_VERSION);
    expect(trained.training.n).toBe(600);
    expect(trained.training.events).toBeGreaterThan(2);
    expect(Number.isFinite(trained.metrics.brier)).toBe(true);
    expect(Number.isFinite(trained.metrics.baselineBrier)).toBe(true);
    expect(trained.metrics.brier).toBeLessThan(trained.metrics.baselineBrier);
    expect(trained.metrics.ece).toBeLessThan(0.05);
    expect(trained.calibration.length).toBeGreaterThan(0);
    for (let index = 1; index < trained.calibration.length; index += 1) {
      expect(trained.calibration[index].y).toBeGreaterThanOrEqual(
        trained.calibration[index - 1].y,
      );
    }
    for (const value of Object.values(trained.coefficients)) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("is deterministic for the same cohort and options", () => {
    const first = artifact();
    const second = artifact();
    expect(second.coefficients).toEqual(first.coefficients);
    expect(second.calibration).toEqual(first.calibration);
    expect(second.metrics).toEqual(first.metrics);
  });

  it("refuses a cohort that is too small or has one class", () => {
    const base = syntheticRows(30);
    expect(() =>
      trainModel(base.slice(0, 10), {
        featureNames: [...V0_FEATURES],
        folds: 5,
        source: "synthetic",
        modelVersion: "small",
        trainedAt: "2026-11-21T00:00:00.000Z",
        engineVersion: "1",
        dataHash: "x",
      }),
    ).toThrow(/at least 20/);

    const oneClass = base.map((row) => ({ ...row, label: 0 as const }));
    expect(() =>
      trainModel(oneClass, {
        featureNames: [...V0_FEATURES],
        folds: 5,
        source: "synthetic",
        modelVersion: "one-class",
        trainedAt: "2026-11-21T00:00:00.000Z",
        engineVersion: "1",
        dataHash: "x",
      }),
    ).toThrow(/flares/);

    expect(() =>
      trainModel(base, {
        featureNames: [...V0_FEATURES],
        folds: 1,
        source: "synthetic",
        modelVersion: "one-fold",
        trainedAt: "2026-11-21T00:00:00.000Z",
        engineVersion: "1",
        dataHash: "x",
      }),
    ).toThrow(/two folds/);
  });

  it("rejects non-finite features and offsets", () => {
    const base = syntheticRows(30);
    const badFeature = { ...base[0], features: { ...base[0].features, peakExposure: Number.NaN } };
    expect(() =>
      trainModel([badFeature, ...base.slice(1)], {
        featureNames: [...V0_FEATURES],
        folds: 5,
        source: "synthetic",
        modelVersion: "bad-feature",
        trainedAt: "2026-11-21T00:00:00.000Z",
        engineVersion: "1",
        dataHash: "x",
      }),
    ).toThrow(/finite/);

    const badOffset = { ...base[0], offset: Number.POSITIVE_INFINITY };
    expect(() =>
      trainModel([badOffset, ...base.slice(1)], {
        featureNames: [...V0_FEATURES],
        folds: 5,
        source: "synthetic",
        modelVersion: "bad-offset",
        trainedAt: "2026-11-21T00:00:00.000Z",
        engineVersion: "1",
        dataHash: "x",
      }),
    ).toThrow(/finite/);
  });

  it("rejects duplicate features and non-positive priors", () => {
    const base = syntheticRows(30);
    expect(() =>
      trainModel(base, {
        featureNames: ["peakExposure", "peakExposure"],
        folds: 5,
        source: "synthetic",
        modelVersion: "duplicate",
        trainedAt: "2026-11-21T00:00:00.000Z",
        engineVersion: "1",
        dataHash: "x",
      }),
    ).toThrow(/unique/);
    expect(() =>
      trainModel(base, {
        featureNames: [...V0_FEATURES],
        folds: 5,
        source: "synthetic",
        modelVersion: "bad-prior",
        trainedAt: "2026-11-21T00:00:00.000Z",
        engineVersion: "1",
        dataHash: "x",
        priorSd: [1, 0, 0.5, 0.5],
      }),
    ).toThrow(/prior standard deviations/);
  });

  it("refuses synthetic rows under an outcomes source", () => {
    const base = syntheticRows(30).map((row) => ({ ...row, synthetic: true as const }));
    expect(() =>
      trainModel(base, {
        featureNames: [...V0_FEATURES],
        folds: 5,
        source: "outcomes",
        modelVersion: "mislabeled",
        trainedAt: "2026-11-21T00:00:00.000Z",
        engineVersion: "1",
        dataHash: "x",
      }),
    ).toThrow(/synthetic rows/);
    expect(() =>
      trainModel(base, {
        featureNames: [...V0_FEATURES],
        folds: 5,
        source: "synthetic",
        modelVersion: "demo",
        trainedAt: "2026-11-21T00:00:00.000Z",
        engineVersion: "1",
        dataHash: "x",
      }),
    ).not.toThrow();
  });

  it("stays finite when a feature perfectly separates the labels", () => {
    const rows: TrainingRow[] = Array.from({ length: 40 }, (_, index) => {
      const high = index % 2 === 0;
      return {
        runId: `run-${index}`,
        userId: `user-${index}`,
        condition: CONDITIONS[index % CONDITIONS.length],
        features: features(high ? 1 : 0.05, 0.8, 3),
        offset: 0,
        label: high ? 1 : 0,
        days: 3,
      };
    });
    const trained = trainModel(rows, {
      featureNames: [...V0_FEATURES],
      folds: 5,
      source: "outcomes",
      modelVersion: "separable",
      trainedAt: "2026-11-21T00:00:00.000Z",
      engineVersion: "1",
      dataHash: "x",
    });
    expect(Number.isFinite(trained.coefficients.peakExposure)).toBe(true);
    expect(Number.isFinite(trained.metrics.brier)).toBe(true);
    expect(trained.metrics.brier).toBeLessThan(0.1);
  });
});

describe("foldIndexFor", () => {
  it("assigns every occurrence of one user to the same fold", () => {
    for (const userId of ["user-a", "user-b", "install-1234", "synthetic-user-7"]) {
      const first = foldIndexFor(userId, 5);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        expect(foldIndexFor(userId, 5)).toBe(first);
      }
      expect(first).toBeGreaterThanOrEqual(0);
      expect(first).toBeLessThan(5);
    }
  });
});

describe("tierFor", () => {
  it("never lets a synthetic artifact drive a live estimate", () => {
    expect(tierFor(artifact(), "asthma_respiratory")).toBe("synthetic");
  });

  it("falls back to the engine below 50 real labels", () => {
    const trained = artifact({ source: "outcomes" });
    const small = {
      ...trained,
      training: { ...trained.training, n: 20 },
    };
    expect(tierFor(small, "asthma_respiratory")).toBe("engine");
  });

  it("uses the pooled tier above 50 labels and condition above 200", () => {
    const trained = artifact({ source: "outcomes" });
    const pooled = { ...trained, training: { ...trained.training, n: 80 } };
    expect(tierFor(pooled, "asthma_respiratory")).toBe("pooled");
    const condition = {
      ...trained,
      training: {
        ...trained.training,
        n: 300,
        byCondition: {
          ...trained.training.byCondition,
          asthma_respiratory: { n: 220, events: 30 },
        },
      },
    };
    expect(tierFor(condition, "asthma_respiratory")).toBe("condition");
  });
});

describe("predictFromArtifact", () => {
  it("returns an ordered interval and the synthetic tier", () => {
    const prediction = predictFromArtifact(
      artifact(),
      features(0.7, 0.5, 4),
      72,
      "asthma_respiratory",
    );
    expect(prediction.tier).toBe("synthetic");
    expect(prediction.pFlare).toBeGreaterThanOrEqual(0.005);
    expect(prediction.pFlare).toBeLessThanOrEqual(1);
    expect(prediction.interval[0]).toBeLessThanOrEqual(prediction.pFlare);
    expect(prediction.interval[1]).toBeGreaterThanOrEqual(prediction.pFlare);
  });

  it("returns the engine probability when the tier is engine", () => {
    const trained = artifact({ source: "outcomes" });
    const small = {
      ...trained,
      training: { ...trained.training, n: 10 },
    };
    const prediction = predictFromArtifact(
      small,
      features(0.7, 0.5, 4),
      80,
      "asthma_respiratory",
    );
    expect(prediction.tier).toBe("engine");
    expect(prediction.pFlare).toBeCloseTo(0.2, 6);
    expect(prediction.interval[0]).toBe(prediction.interval[1]);
  });
});

describe("riskCurve", () => {
  it("is non-decreasing when peak exposure has a positive coefficient", () => {
    const trained = artifact();
    expect(
      (trained.coefficients.peakExposure ?? 0) > 0,
    ).toBe(true);
    const curve = riskCurve(
      trained,
      features(0.6, 0.8, 4),
      70,
      "asthma_respiratory",
    );
    expect(curve).toHaveLength(9);
    for (let index = 1; index < curve.length; index += 1) {
      expect(curve[index].pFlare).toBeGreaterThanOrEqual(
        curve[index - 1].pFlare,
      );
    }
  });
});
