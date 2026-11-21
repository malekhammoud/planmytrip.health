/**
 * Offline training for the calibrated flare model.
 *
 * Inputs: labeled training rows, a feature list, fold count, artifact metadata, and a
 * data hash. Outputs: a complete ModelArtifact with coefficients, Laplace covariance,
 * isotonic calibration, and out-of-fold metrics.
 * Invariants: folds are grouped by userId so one traveler never leaks across train and
 * validation; standardization is fitted inside each fold; the isotonic map used for a
 * held-out fold is fitted only on the other folds, so the reported metrics are nested
 * out-of-fold rather than in-sample for the calibrator; a zero-coefficient model is the
 * engine; the artifact records its source and sample size so a synthetic model can never
 * be mistaken for a validated one.
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
  featureValue,
} from "./features";
import { fitLogistic } from "./logistic";
import { dot, sigmoid } from "./math";
import {
  MODEL_PIPELINE_VERSION,
  type FeatureName,
  type FeatureRow,
  type FeatureStat,
  type ModelArtifact,
  type ModelMetrics,
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

/**
 * Deterministic, traveler-grouped fold assignment. Exported so the grouping guarantee is
 * testable directly: one user id always maps to exactly one fold.
 */
export function foldIndexFor(userId: string, folds: number): number {
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

function featureRows(rows: readonly TrainingRow[]): FeatureRow[] {
  return rows.map((row) => ({
    features: row.features,
    offset: row.offset,
    label: row.label,
  }));
}

function hasBothClasses(labels: readonly number[]): boolean {
  let positives = 0;
  for (const label of labels) if (label === 1) positives += 1;
  return positives > 0 && positives < labels.length;
}

interface FittedSlice {
  stats: Record<FeatureName, FeatureStat>;
  beta: number[];
}

/** Fits scaling and coefficients on one index set, or returns null when it cannot. */
function fitSlice(
  rows: readonly TrainingRow[],
  indexes: readonly number[],
  featureNames: readonly FeatureName[],
  priorSd: readonly number[],
): FittedSlice | null {
  if (indexes.length < 2) return null;
  if (!hasBothClasses(indexes.map((index) => rows[index].label))) return null;
  const stats = computeFeatureStats(featureRows(indexes.map((index) => rows[index])));
  const fit = fitLogistic(
    indexes.map((index) => buildDesignRow(rows[index].features, featureNames, stats)),
    indexes.map((index) => rows[index].label),
    indexes.map((index) => rows[index].offset),
    priorSd,
  );
  return { stats, beta: fit.beta };
}

function predictWith(
  slice: FittedSlice,
  row: TrainingRow,
  featureNames: readonly FeatureName[],
): number {
  const design = buildDesignRow(row.features, featureNames, slice.stats);
  return sigmoid(dot(design, slice.beta) + row.offset);
}

function allIndexes(rows: readonly TrainingRow[]): number[] {
  return rows.map((_, index) => index);
}

/**
 * Out-of-fold logistic predictions. Each fold's standardization and coefficients are
 * fitted on that fold's training rows only, so no held-out value touches the scaler.
 */
function outOfFoldPredictions(
  rows: readonly TrainingRow[],
  folds: readonly number[][],
  featureNames: readonly FeatureName[],
  priorSd: readonly number[],
): number[] {
  const predictions = rows.map((row) => sigmoid(row.offset));
  for (const heldOut of folds) {
    if (heldOut.length === 0) continue;
    const heldOutSet = new Set(heldOut);
    const trainIndexes = allIndexes(rows).filter((index) => !heldOutSet.has(index));
    const slice = fitSlice(rows, trainIndexes, featureNames, priorSd);
    if (slice === null) continue;
    for (const index of heldOut) {
      predictions[index] = predictWith(slice, rows[index], featureNames);
    }
  }
  return predictions;
}

/**
 * Properly nested out-of-fold calibration. For each outer held-out fold, an inner
 * grouped cross-validation runs only inside that fold's training rows; the isotonic map
 * is fitted on those inner predictions and then applied to the outer fold. The outer
 * fold's labels never influence either the inner models or the calibrator. When the
 * inner cohort is too small or single-class, the raw prediction is kept rather than
 * pretending an undefined map is a perfect score.
 */
function calibratedOutOfFold(
  rows: readonly TrainingRow[],
  folds: readonly number[][],
  raw: readonly number[],
  featureNames: readonly FeatureName[],
  priorSd: readonly number[],
): number[] {
  const calibrated = [...raw];
  for (let outer = 0; outer < folds.length; outer += 1) {
    const outerHeld = folds[outer];
    if (outerHeld.length === 0) continue;
    const outerSet = new Set(outerHeld);
    const points: { x: number; y: number }[] = [];
    for (let inner = 0; inner < folds.length; inner += 1) {
      if (inner === outer) continue;
      const innerHeld = folds[inner];
      if (innerHeld.length === 0) continue;
      const innerSet = new Set(innerHeld);
      const trainIndexes = allIndexes(rows).filter(
        (index) => !outerSet.has(index) && !innerSet.has(index),
      );
      const slice = fitSlice(rows, trainIndexes, featureNames, priorSd);
      if (slice === null) continue;
      for (const index of innerHeld) {
        points.push({
          x: predictWith(slice, rows[index], featureNames),
          y: rows[index].label,
        });
      }
    }
    if (points.length < 2) continue;
    if (!hasBothClasses(points.map((point) => point.y))) continue;
    const map = fitIsotonic(points);
    for (const index of outerHeld) {
      calibrated[index] = applyIsotonic(map, raw[index]);
    }
  }
  return calibrated;
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
  if (options.featureNames.length === 0) {
    throw new Error("need at least one feature");
  }
  if (new Set(options.featureNames).size !== options.featureNames.length) {
    throw new Error("feature names must be unique");
  }
  if (!Number.isInteger(options.folds) || options.folds < 2) {
    throw new Error("need at least two folds");
  }
  const labels = rows.map((row) => row.label);
  const events = labels.reduce<number>((sum, label) => sum + label, 0);
  if (events < 2 || events > labels.length - 2) {
    throw new Error("need at least two flares and two non-flares");
  }
  if (options.source === "outcomes" && rows.some((row) => row.synthetic === true)) {
    throw new Error("synthetic rows cannot be trained as observed outcomes");
  }
  for (const row of rows) {
    if (row.label !== 0 && row.label !== 1) {
      throw new Error("labels must be 0 or 1");
    }
    if (!Number.isFinite(row.offset)) throw new Error("offsets must be finite");
    for (const name of options.featureNames) {
      if (!Number.isFinite(featureValue(row.features, name))) {
        throw new Error(`feature ${name} must be finite`);
      }
    }
  }

  const stats: Record<FeatureName, FeatureStat> = computeFeatureStats(
    featureRows(rows),
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
  if (priorSd.some((sd) => !Number.isFinite(sd) || sd <= 0)) {
    throw new Error("prior standard deviations must be positive and finite");
  }

  const folds = Array.from({ length: options.folds }, () => [] as number[]);
  rows.forEach((row, index) => {
    folds[foldIndexFor(row.userId, options.folds)].push(index);
  });

  const raw = outOfFoldPredictions(rows, folds, options.featureNames, priorSd);
  const calibrated = calibratedOutOfFold(
    rows,
    folds,
    raw,
    options.featureNames,
    priorSd,
  );

  // The deployed map is fitted on every out-of-fold prediction, which is the largest
  // honest calibration sample this cohort can offer. Reported metrics stay nested.
  const calibration = fitIsotonic(
    raw.map((probability, index) => ({ x: probability, y: labels[index] })),
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
    auroc: auroc(labels, raw),
    calibrationSlope: calibrationSlope(labels, raw),
  };

  // VERIFY: docs/MODEL_CARD.md must be regenerated from this artifact after every training
  // run, and its metrics must match the values below.
  const featureStats = { ...stats };

  return {
    schemaVersion: 1,
    pipelineVersion: MODEL_PIPELINE_VERSION,
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
