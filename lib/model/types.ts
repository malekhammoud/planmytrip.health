/**
 * Shared model vocabulary: feature names, the trained artifact, metrics, and predictions.
 *
 * Inputs: none. Outputs: typed artifacts and predictions used by training, inference,
 * the model page, and tests. Invariants: v0 uses three features; a synthetic artifact
 * never drives a live plan; every prediction carries its sample size and tier.
 */

import type { Condition } from "../types";
import type { TripFeatures } from "../data/types";

/**
 * Training/evaluation pipeline version. Bump when the fitting or evaluation semantics
 * change even if the JSON shape does not, so metrics from two procedures can never be
 * compared as if they came from one.
 */
export const MODEL_PIPELINE_VERSION = 2 as const;

/** Features the v0 calibration uses. Three parameters is deliberate at small n. */
export const V0_FEATURES = [
  "peakExposure",
  "recoveryCoverage",
  "tripLength",
] as const satisfies readonly FeatureName[];

/** Features reserved for v1, once ~1,000 labeled trips exist. */
export const V1_FEATURES = [
  "peakExposure",
  "recoveryCoverage",
  "tripLength",
  "adherence",
  "heatFlag",
  "altitudeFlag",
  "baselineBurden",
] as const satisfies readonly FeatureName[];

/** Every feature the feature builder understands. */
export type FeatureName =
  | "peakExposure"
  | "recoveryCoverage"
  | "tripLength"
  | "adherence"
  | "heatFlag"
  | "altitudeFlag"
  | "baselineBurden";

/** Standardization statistics stored with the artifact. */
export interface FeatureStat {
  mean: number;
  std: number;
}

/** Out-of-fold performance recorded in the artifact. */
export interface ModelMetrics {
  n: number;
  events: number;
  brier: number;
  baselineBrier: number;
  logLoss: number;
  ece: number;
  auroc: number;
  calibrationSlope: number;
}

/** One point of the isotonic calibration map. */
export interface CalibrationPoint {
  x: number;
  y: number;
}

/** A trained, versioned artifact. The runtime is a dot product, not a service. */
export interface ModelArtifact {
  schemaVersion: 1;
  /** Training/evaluation procedure that produced this artifact. */
  pipelineVersion: typeof MODEL_PIPELINE_VERSION;
  modelVersion: string;
  trainedAt: string;
  engineVersion: string;
  source: "synthetic" | "outcomes";
  featureNames: FeatureName[];
  featureStats: Record<FeatureName, FeatureStat>;
  coefficients: { intercept: number } & Partial<Record<FeatureName, number>>;
  covariance: number[][];
  calibration: CalibrationPoint[];
  training: {
    n: number;
    events: number;
    meanOffset: number;
    byCondition: Record<Condition, { n: number; events: number }>;
    dataHash: string;
  };
  metrics: ModelMetrics;
}

/**
 * `engine` means the engine is the only allowed estimate. `synthetic` is a trained demo
 * that must never drive a live plan. `pooled` and `condition` are real-data tiers.
 */
export type ModelTier = "engine" | "synthetic" | "pooled" | "condition";

/** One calibrated prediction with an interval and its evidence tier. */
export interface FlarePrediction {
  pFlare: number;
  interval: [number, number];
  n: number;
  nCondition: number;
  tier: ModelTier;
  modelVersion: string;
}

/** Feature row plus the engine offset and label, ready for training. */
export interface FeatureRow {
  features: TripFeatures;
  offset: number;
  label: 0 | 1;
}
