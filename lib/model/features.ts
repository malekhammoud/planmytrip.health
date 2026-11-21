/**
 * Feature vectors and standardization for the calibration model.
 *
 * Inputs: TripFeatures rows and a selected feature list. Outputs: standardized design
 * rows and the stored per-feature statistics. Invariants: a zero-variance feature gets
 * std 1 so inference never divides by zero; the intercept is always column zero.
 */

import type { TripFeatures } from "../data/types";
import { clamp, logit, mean, std } from "./math";
import {
  V1_FEATURES,
  type FeatureName,
  type FeatureRow,
  type FeatureStat,
} from "./types";

/** Reads one feature, applying the documented null defaults. */
export function featureValue(features: TripFeatures, name: FeatureName): number {
  switch (name) {
    case "peakExposure":
      return features.peakExposure;
    case "recoveryCoverage":
      return features.recoveryCoverage;
    case "tripLength":
      return features.tripLength;
    case "adherence":
      return features.adherence ?? 1;
    case "heatFlag":
      return features.heatFlag;
    case "altitudeFlag":
      return features.altitudeFlag;
    case "baselineBurden":
      return features.baselineBurden ?? 0;
  }
}

/** Statistics for every understood feature, even the ones v0 does not use. */
export function computeFeatureStats(
  rows: readonly FeatureRow[],
): Record<FeatureName, FeatureStat> {
  const stats = {} as Record<FeatureName, FeatureStat>;
  for (const name of V1_FEATURES) {
    const values = rows.map((row) => featureValue(row.features, name));
    const deviation = std(values);
    stats[name] = { mean: mean(values), std: deviation > 1e-6 ? deviation : 1 };
  }
  return stats;
}

/** Builds one design row: `[1, ...standardized features]`. */
export function buildDesignRow(
  features: TripFeatures,
  names: readonly FeatureName[],
  stats: Record<FeatureName, FeatureStat>,
): number[] {
  const row = [1];
  for (const name of names) {
    const stat = stats[name];
    row.push((featureValue(features, name) - stat.mean) / stat.std);
  }
  return row;
}

/** The engine's modeled risk as a probability prior. */
export function engineProbability(healthSafetyScore: number): number {
  return clamp((100 - healthSafetyScore) / 100, 0.01, 0.99);
}

/** The engine's prior on the log-odds scale. */
export function engineOffset(healthSafetyScore: number): number {
  return logit(engineProbability(healthSafetyScore));
}
