/**
 * Loads and validates the trained model artifact.
 *
 * Inputs: lib/model/model.json produced by scripts/train-model.ts. Outputs: a validated
 * ModelArtifact plus a safe empty artifact when the file is absent or malformed.
 * Invariants: a malformed artifact never reaches inference; the empty artifact returns
 * the engine estimate with tier engine.
 */

import artifactJson from "./model.json";
import { CONDITIONS } from "../types";
import type { Condition } from "../types";
import { ENGINE_VERSION } from "../data/types";
import {
  V0_FEATURES,
  type FeatureName,
  type ModelArtifact,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValid(value: unknown): value is ModelArtifact {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== 1) return false;
  if (typeof value.modelVersion !== "string") return false;
  if (value.source !== "synthetic" && value.source !== "outcomes") return false;
  if (!Array.isArray(value.featureNames)) return false;
  if (!isRecord(value.featureStats)) return false;
  if (!isRecord(value.coefficients) || typeof value.coefficients.intercept !== "number") {
    return false;
  }
  if (!Array.isArray(value.covariance)) return false;
  if (!Array.isArray(value.calibration)) return false;
  if (!isRecord(value.training)) return false;
  if (typeof value.training.n !== "number") return false;
  if (!isRecord(value.metrics)) return false;
  return true;
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

/** True when model.json parsed into the expected shape. */
export const MODEL_AVAILABLE = isValid(artifactJson);

/** The runtime artifact; a malformed file falls back to the engine-only artifact. */
// VERIFY: the committed artifact is trained on synthetic trips. Never use it for a live
// plan; replace it only with an `outcomes` artifact whose tier is pooled or condition.
export const MODEL_ARTIFACT: ModelArtifact = isValid(artifactJson)
  ? artifactJson
  : EMPTY;
