/**
 * Loads and validates the trained model artifact.
 *
 * Inputs: lib/model/model.json produced by scripts/train-model.ts. Outputs: a validated
 * ModelArtifact plus a safe engine-only artifact when the file is absent or malformed.
 * Invariants: a malformed, truncated, or differently-versioned artifact never reaches
 * inference; every array is dimension-checked against featureNames; the engine-only
 * artifact returns the engine estimate with tier engine.
 */

import artifactJson from "./model.json";
import { CONDITIONS } from "../types";
import type { Condition } from "../types";
import { ENGINE_VERSION } from "../data/types";
import {
  MODEL_PIPELINE_VERSION,
  V0_FEATURES,
  V1_FEATURES,
  type FeatureName,
  type ModelArtifact,
} from "./types";

const FEATURE_NAMES = new Set<string>(V1_FEATURES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isFeatureName(value: unknown): value is FeatureName {
  return typeof value === "string" && FEATURE_NAMES.has(value);
}

function isFeatureStat(value: unknown): value is { mean: number; std: number } {
  return (
    isRecord(value) &&
    isFiniteNumber(value.mean) &&
    isFiniteNumber(value.std) &&
    value.std > 0
  );
}

function isCalibrationPoint(value: unknown): value is { x: number; y: number } {
  return (
    isRecord(value) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    value.x >= 0 &&
    value.x <= 1 &&
    value.y >= 0 &&
    value.y <= 1
  );
}

function isCalibration(value: unknown): value is { x: number; y: number }[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  let previous = -1;
  let previousX = -1;
  for (const point of value) {
    if (!isCalibrationPoint(point)) return false;
    if (point.y < previous || point.x < previousX) return false;
    previous = point.y;
    previousX = point.x;
  }
  return true;
}

function isValidMetrics(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const keys = [
    "n",
    "events",
    "brier",
    "baselineBrier",
    "logLoss",
    "ece",
    "auroc",
    "calibrationSlope",
  ] as const;
  if (!keys.every((key) => isFiniteNumber(value[key]))) return false;
  const n = value.n as number;
  const events = value.events as number;
  if (n < 0 || events < 0 || events > n) return false;
  const brier = value.brier as number;
  const baselineBrier = value.baselineBrier as number;
  const logLoss = value.logLoss as number;
  const ece = value.ece as number;
  const auroc = value.auroc as number;
  return (
    brier >= 0 &&
    brier <= 1 &&
    baselineBrier >= 0 &&
    baselineBrier <= 1 &&
    logLoss >= 0 &&
    ece >= 0 &&
    ece <= 1 &&
    auroc >= 0 &&
    auroc <= 1
  );
}

function isValidTraining(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!isFiniteNumber(value.n) || value.n < 0) return false;
  if (!isFiniteNumber(value.events) || value.events < 0) return false;
  if (value.events > value.n) return false;
  if (!isFiniteNumber(value.meanOffset)) return false;
  if (typeof value.dataHash !== "string") return false;
  if (!isRecord(value.byCondition)) return false;
  return CONDITIONS.every((condition: Condition) => {
    const counts = value.byCondition as Record<string, unknown>;
    const entry = counts[condition];
    return (
      isRecord(entry) &&
      isFiniteNumber(entry.n) &&
      entry.n >= 0 &&
      isFiniteNumber(entry.events) &&
      entry.events >= 0 &&
      entry.events <= entry.n
    );
  });
}

/**
 * Parses an untrusted artifact. Every dimension is checked: feature names, per-feature
 * statistics, coefficients, the covariance matrix, the isotonic knots, the training
 * counts, and the metrics. Returns null rather than a half-valid object.
 */
export function parseArtifact(value: unknown): ModelArtifact | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== 1) return null;
  if (value.pipelineVersion !== MODEL_PIPELINE_VERSION) return null;
  if (typeof value.modelVersion !== "string" || value.modelVersion.length === 0) {
    return null;
  }
  if (typeof value.engineVersion !== "string") return null;
  if (typeof value.trainedAt !== "string") return null;
  if (Number.isNaN(new Date(value.trainedAt).getTime())) return null;
  if (value.source !== "synthetic" && value.source !== "outcomes") return null;

  if (!Array.isArray(value.featureNames) || value.featureNames.length === 0) {
    return null;
  }
  const featureNames = value.featureNames.filter(isFeatureName);
  if (featureNames.length !== value.featureNames.length) return null;
  if (new Set(featureNames).size !== featureNames.length) return null;

  if (!isRecord(value.featureStats)) return null;
  for (const name of featureNames) {
    if (!isFeatureStat(value.featureStats[name])) return null;
  }

  if (!isRecord(value.coefficients)) return null;
  if (!isFiniteNumber(value.coefficients.intercept)) return null;
  for (const name of featureNames) {
    if (!isFiniteNumber(value.coefficients[name])) return null;
  }

  const width = featureNames.length + 1;
  if (!Array.isArray(value.covariance) || value.covariance.length !== width) {
    return null;
  }
  for (const row of value.covariance) {
    if (!Array.isArray(row) || row.length !== width) return null;
    if (!row.every(isFiniteNumber)) return null;
  }

  if (!isCalibration(value.calibration)) return null;
  if (!isValidTraining(value.training)) return null;
  if (!isValidMetrics(value.metrics)) return null;
  const training = value.training as ModelArtifact["training"];
  const metrics = value.metrics as ModelArtifact["metrics"];
  if (metrics.n !== training.n || metrics.events !== training.events) return null;

  return {
    schemaVersion: 1,
    pipelineVersion: MODEL_PIPELINE_VERSION,
    modelVersion: value.modelVersion,
    trainedAt: value.trainedAt,
    engineVersion: value.engineVersion,
    source: value.source,
    featureNames: featureNames as FeatureName[],
    featureStats: value.featureStats as ModelArtifact["featureStats"],
    coefficients: value.coefficients as ModelArtifact["coefficients"],
    covariance: value.covariance as number[][],
    calibration: value.calibration as ModelArtifact["calibration"],
    training,
    metrics,
  };
}

function emptyByCondition(): Record<Condition, { n: number; events: number }> {
  const record = {} as Record<Condition, { n: number; events: number }>;
  for (const condition of CONDITIONS) record[condition] = { n: 0, events: 0 };
  return record;
}

function zeroStats(): Record<FeatureName, { mean: number; std: number }> {
  const names: FeatureName[] = [...V0_FEATURES];
  const record = {} as Record<FeatureName, { mean: number; std: number }>;
  for (const name of names) record[name] = { mean: 0, std: 1 };
  return record;
}

const EMPTY: ModelArtifact = {
  schemaVersion: 1,
  pipelineVersion: MODEL_PIPELINE_VERSION,
  modelVersion: "unavailable",
  trainedAt: new Date(0).toISOString(),
  engineVersion: ENGINE_VERSION,
  source: "synthetic",
  featureNames: [...V0_FEATURES],
  featureStats: zeroStats(),
  coefficients: { intercept: 0 },
  covariance: [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ],
  calibration: [],
  training: {
    n: 0,
    events: 0,
    meanOffset: 0,
    byCondition: emptyByCondition(),
    dataHash: "",
  },
  metrics: {
    n: 0,
    events: 0,
    brier: 0,
    baselineBrier: 0,
    logLoss: 0,
    ece: 0,
    auroc: 0.5,
    calibrationSlope: 1,
  },
};

const parsed = parseArtifact(artifactJson);

/** True when model.json parsed into the expected shape and pipeline version. */
export const MODEL_AVAILABLE = parsed !== null;

/** The runtime artifact; a malformed file falls back to the engine-only artifact. */
// VERIFY: the committed artifact is trained on synthetic trips. Never use it for a live
// plan; replace it only with an `outcomes` artifact whose tier is pooled or condition.
export const MODEL_ARTIFACT: ModelArtifact = parsed ?? EMPTY;
