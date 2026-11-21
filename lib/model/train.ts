/**
 * Offline training for the calibrated flare model.
 *
 * Inputs: labeled training rows, a feature list, fold count, artifact metadata, and a
 * data hash. Outputs: a complete ModelArtifact with coefficients, Laplace covariance,
 * isotonic calibration, and out-of-fold metrics.
 * Invariants: folds are grouped by userId so one traveler never leaks across train and
 * validation; a zero-coefficient model is the engine; the artifact records its source and
 * sample size so a synthetic model can never be mistaken for a validated one.
 */

import type { Condition } from "../types";
import { CONDITIONS } from "../types";
import type { TrainingRow } from "../data/types";
import {
  applyIsotonic,
  auroc,
  brierScore,
  calibrationSlope,
  expectedCalibrationError,
  fitIsotonic,
  logLoss,
} from "./calibration";
import {
  buildDesignRow,
  computeFeatureStats,
} from "./features";
import { fitLogistic } from "./logistic";
import { dot, sigmoid } from "./math";
import type {
  FeatureName,
  ModelArtifact,
  ModelMetrics,
} from "./types";

/** Training configuration; the script supplies dates and hashes. */
export interface TrainOptions {
  featureNames: FeatureName[];
  folds: number;
  source: "synthetic" | "outcomes";
  modelVersion: string;
  trainedAt: string;
  engineVersion: string;
  dataHash: string;
  /** One prior SD per coefficient, intercept first. Defaults to 1.0 and 0.5. */
  priorSd?: number[];
}

function foldFor(userId: string, folds: number): number {
  let hash = 2166136261;
  for (let index = 0; index < userId.length; index += 1) {
    hash ^= userId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % folds;
}

function emptyByCondition(): Record<Condition, { n: number; events: number }> {
  const record = {} as Record<Condition, { n: number; events: number }>;
  for (const condition of CONDITIONS) record[condition] = { n: 0, events: 0 };
  return record;
}

/**
 * Trains and evaluates one artifact. Throws on a dataset that cannot support a model
 * (too few rows, one class, or fewer than two folds).
 */
export function trainModel(
  rows: readonly TrainingRow[],
  options: TrainOptions,
): ModelArtifact {
  if (rows.length < 20) throw new Error("need at least 20 labeled trips");
  if (!Number.isInteger(options.folds) || options.folds < 2) {
    throw new Error("need at least two folds");
  }
  const labels = rows.map((row) => row.label);
  const events = labels.reduce<number>((sum, label) => sum + label, 0);
  if (events < 2 || events > labels.length - 2) {
    throw new Error("need at least two flares and two non-flares");
  }

  const stats = computeFeatureStats(
    rows.map((row) => ({ features: row.features, offset: row.offset, label: row.label })),
  );
  const design = rows.map((row) =>
    buildDesignRow(row.features, options.featureNames, stats),
  );
  const offsets = rows.map((row) => row.offset);
  const priorSd =
    options.priorSd ?? [1, ...options.featureNames.map(() => 0.5)];
  if (priorSd.length !== design[0].length) {
    throw new Error("prior width does not match the design");
  }

  const folds = Array.from({ length: options.folds }, () => [] as number[]);
  rows.forEach((row, index) => {
    folds[foldFor(row.userId, options.folds)].push(index);
  });
  const oof = new Array<number>(rows.length).fill(0.5);
  for (const heldOut of folds) {
    if (heldOut.length === 0) continue;
    const heldOutSet = new Set(heldOut);
    const trainIndexes = rows
      .map((_, index) => index)
      .filter((index) => !heldOutSet.has(index));
    const foldFit = fitLogistic(
      trainIndexes.map((index) => design[index]),
      trainIndexes.map((index) => labels[index]),
      trainIndexes.map((index) => offsets[index]),
      priorSd,
    );
    for (const index of heldOut) {
      oof[index] = sigmoid(dot(design[index], foldFit.beta) + offsets[index]);
    }
  }

  const calibration = fitIsotonic(
    oof.map((probability, index) => ({ x: probability, y: labels[index] })),
  );
  const calibrated = oof.map((probability) =>
    applyIsotonic(calibration, probability),
  );
  const baseline = offsets.map((offset) => sigmoid(offset));

  const finalFit = fitLogistic(design, labels, offsets, priorSd);
  const coefficients = { intercept: finalFit.beta[0] } as ModelArtifact["coefficients"];
  options.featureNames.forEach((name, index) => {
    coefficients[name] = finalFit.beta[index + 1];
  });

  const byCondition = emptyByCondition();
  rows.forEach((row) => {
    byCondition[row.condition].n += 1;
    byCondition[row.condition].events += row.label;
  });

  const metrics: ModelMetrics = {
    n: rows.length,
    events,
    brier: brierScore(labels, calibrated),
    baselineBrier: brierScore(labels, baseline),
    logLoss: logLoss(labels, calibrated),
    ece: expectedCalibrationError(labels, calibrated),
    auroc: auroc(labels, oof),
    calibrationSlope: calibrationSlope(labels, oof),
  };

  // VERIFY: docs/MODEL_CARD.md must be regenerated from this artifact after every training
  // run, and its metrics must match the values below.
  const featureStats = { ...stats };

  return {
    schemaVersion: 1,
    modelVersion: options.modelVersion,
    trainedAt: options.trainedAt,
    engineVersion: options.engineVersion,
    source: options.source,
    featureNames: [...options.featureNames],
    featureStats,
    coefficients,
    covariance: finalFit.covariance,
    calibration,
    training: {
      n: rows.length,
      events,
      meanOffset:
        offsets.reduce((sum, offset) => sum + offset, 0) / Math.max(1, offsets.length),
      byCondition,
      dataHash: options.dataHash,
    },
    metrics,
  };
}
