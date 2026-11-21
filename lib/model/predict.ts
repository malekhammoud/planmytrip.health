/**
 * Inference for the calibrated flare model.
 *
 * Inputs: a trained artifact, a feature row, the engine's safety score, and a condition.
 * Outputs: a calibrated probability, a 90% interval, the evidence tier, and the model
 * version. Invariants: a synthetic artifact is always labelled synthetic; below 50 real
 * labels the engine remains the estimate; the interval is ordered and finite.
 */

import type { Condition } from "../types";
import type { TripFeatures } from "../data/types";
import { applyIsotonic } from "./calibration";
import { engineProbability, featureValue } from "./features";
import { dot, logit, quadraticForm, sigmoid } from "./math";
import type {
  FlarePrediction,
  ModelArtifact,
  ModelTier,
} from "./types";

const Z_90 = 1.645;

/**
 * A calibrated zero is overconfident in a health context. The floor keeps the interface
 * honest: "less than 1%" rather than "impossible".
 */
const MIN_PROBABILITY = 0.005;
const MAX_PROBABILITY = 0.995;

function guardProbability(value: number): number {
  return Math.max(MIN_PROBABILITY, Math.min(MAX_PROBABILITY, value));
}

/** Evidence tier for a condition, based on the artifact's source and counts. */
export function tierFor(
  artifact: ModelArtifact,
  condition: Condition,
): ModelTier {
  if (artifact.source === "synthetic") return "synthetic";
  if (artifact.training.n < 50) return "engine";
  if ((artifact.training.byCondition[condition]?.n ?? 0) >= 200) return "condition";
  return "pooled";
}

function designRow(
  artifact: ModelArtifact,
  features: TripFeatures,
): number[] {
  const row = [1];
  for (const name of artifact.featureNames) {
    const stat = artifact.featureStats[name];
    row.push((featureValue(features, name) - stat.mean) / Math.max(stat.std, 1e-9));
  }
  return row;
}

function betaVector(artifact: ModelArtifact): number[] {
  return [
    artifact.coefficients.intercept,
    ...artifact.featureNames.map((name) => artifact.coefficients[name] ?? 0),
  ];
}

/**
 * Predicts one trip. The engine's score becomes the prior log-odds; the artifact learns
 * only the residual. A synthetic artifact is shown in the lab but never used live.
 */
export function predictFromArtifact(
  artifact: ModelArtifact,
  features: TripFeatures,
  healthSafetyScore: number,
  condition: Condition,
): FlarePrediction {
  const offset = logit(engineProbability(healthSafetyScore));
  const tier = tierFor(artifact, condition);
  const nCondition = artifact.training.byCondition[condition]?.n ?? 0;

  if (tier === "engine") {
    const p = engineProbability(healthSafetyScore);
    return {
      pFlare: p,
      interval: [p, p],
      n: artifact.training.n,
      nCondition,
      tier,
      modelVersion: artifact.modelVersion,
    };
  }

  const row = designRow(artifact, features);
  const eta = offset + dot(row, betaVector(artifact));
  const raw = sigmoid(eta);
  const calibrated = guardProbability(applyIsotonic(artifact.calibration, raw));
  const standardError = Math.sqrt(
    Math.max(0, quadraticForm(row, artifact.covariance)),
  );
  const lower = guardProbability(
    applyIsotonic(
      artifact.calibration,
      sigmoid(eta - Z_90 * standardError),
    ),
  );
  const upper = guardProbability(
    applyIsotonic(
      artifact.calibration,
      sigmoid(eta + Z_90 * standardError),
    ),
  );
  return {
    pFlare: calibrated,
    interval: [Math.min(lower, calibrated), Math.max(upper, calibrated)],
    n: artifact.training.n,
    nCondition,
    tier,
    modelVersion: artifact.modelVersion,
  };
}

/** One point on the illustrative exposure-risk curve. */
export interface RiskCurvePoint {
  peakExposure: number;
  pFlare: number;
}

/**
 * Sweeps peak exposure while holding the other features fixed. Used by the model page;
 * it is illustrative, not a prescription.
 */
export function riskCurve(
  artifact: ModelArtifact,
  features: TripFeatures,
  healthSafetyScore: number,
  condition: Condition,
  start = 0.3,
  end = 1.1,
  steps = 9,
): RiskCurvePoint[] {
  const points: RiskCurvePoint[] = [];
  for (let index = 0; index < steps; index += 1) {
    const ratio = index / Math.max(1, steps - 1);
    const peakExposure = start + ratio * (end - start);
    const prediction = predictFromArtifact(
      artifact,
      { ...features, peakExposure },
      healthSafetyScore,
      condition,
    );
    points.push({ peakExposure, pFlare: prediction.pFlare });
  }
  return points;
}
