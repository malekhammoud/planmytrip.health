/**
 * Probability calibration and honest evaluation metrics.
 *
 * Inputs: binary labels and predicted probabilities. Outputs: an isotonic map, Brier
 * score, log loss, expected calibration error, AUROC, calibration slope, and a
 * reliability table for the model page.
 * Invariants: the isotonic map is monotone non-decreasing; probabilities are clamped
 * away from 0 and 1 before logs; every metric returns a finite number.
 */

import { fitLogistic } from "./logistic";
import { clamp, logit } from "./math";
import type { CalibrationPoint } from "./types";

interface PoolBlock {
  x: number;
  y: number;
  count: number;
}

/**
 * Pool-adjacent-violators. Sorts by predicted probability and merges any block that
 * breaks monotonicity, so the calibration curve never says a higher score is safer.
 */
export function fitIsotonic(
  points: readonly { x: number; y: number }[],
): CalibrationPoint[] {
  const sorted = [...points].sort((left, right) => left.x - right.x);
  const blocks: PoolBlock[] = [];
  for (const point of sorted) {
    blocks.push({ x: point.x, y: point.y, count: 1 });
    while (
      blocks.length > 1 &&
      blocks[blocks.length - 2].y > blocks[blocks.length - 1].y
    ) {
      const right = blocks[blocks.length - 1];
      const left = blocks[blocks.length - 2];
      blocks.length -= 2;
      const count = left.count + right.count;
      blocks.push({
        x: (left.x * left.count + right.x * right.count) / count,
        y: (left.y * left.count + right.y * right.count) / count,
        count,
      });
    }
  }
  return blocks.map((block) => ({ x: block.x, y: block.y }));
}

/** Applies the isotonic map with linear interpolation between knots. */
export function applyIsotonic(
  points: readonly CalibrationPoint[],
  probability: number,
): number {
  if (points.length === 0) return probability;
  if (probability <= points[0].x) return points[0].y;
  const last = points[points.length - 1];
  if (probability >= last.x) return last.y;
  for (let index = 0; index < points.length - 1; index += 1) {
    const left = points[index];
    const right = points[index + 1];
    if (probability < left.x || probability > right.x) continue;
    const width = right.x - left.x;
    if (width <= 1e-12) return right.y;
    const ratio = (probability - left.x) / width;
    return left.y + ratio * (right.y - left.y);
  }
  return last.y;
}

/** Mean squared error of predicted probabilities. */
export function brierScore(
  labels: readonly number[],
  probabilities: readonly number[],
): number {
  if (labels.length === 0) return 0;
  let sum = 0;
  for (let index = 0; index < labels.length; index += 1) {
    sum += (probabilities[index] - labels[index]) ** 2;
  }
  return sum / labels.length;
}

/** Mean binary log loss with probabilities clamped away from the edges. */
export function logLoss(
  labels: readonly number[],
  probabilities: readonly number[],
): number {
  if (labels.length === 0) return 0;
  let sum = 0;
  for (let index = 0; index < labels.length; index += 1) {
    const p = clamp(probabilities[index], 1e-6, 1 - 1e-6);
    sum += -(labels[index] * Math.log(p) + (1 - labels[index]) * Math.log(1 - p));
  }
  return sum / labels.length;
}

/** Expected calibration error over equal-width probability bins. */
export function expectedCalibrationError(
  labels: readonly number[],
  probabilities: readonly number[],
  bins = 10,
): number {
  if (labels.length === 0) return 0;
  const counts = new Array<number>(bins).fill(0);
  const confidence = new Array<number>(bins).fill(0);
  const observed = new Array<number>(bins).fill(0);
  for (let index = 0; index < labels.length; index += 1) {
    const bin = Math.min(bins - 1, Math.floor(probabilities[index] * bins));
    counts[bin] += 1;
    confidence[bin] += probabilities[index];
    observed[bin] += labels[index];
  }
  let error = 0;
  for (let bin = 0; bin < bins; bin += 1) {
    if (counts[bin] === 0) continue;
    error +=
      (counts[bin] / labels.length) *
      Math.abs(confidence[bin] / counts[bin] - observed[bin] / counts[bin]);
  }
  return error;
}

/** Rank-based AUROC with average credit for ties. Returns 0.5 when undefined. */
export function auroc(
  labels: readonly number[],
  probabilities: readonly number[],
): number {
  let positives = 0;
  let negatives = 0;
  for (const label of labels) {
    if (label === 1) positives += 1;
    else negatives += 1;
  }
  if (positives === 0 || negatives === 0) return 0.5;
  let wins = 0;
  for (let left = 0; left < labels.length; left += 1) {
    if (labels[left] !== 1) continue;
    for (let right = 0; right < labels.length; right += 1) {
      if (labels[right] !== 0) continue;
      if (probabilities[left] > probabilities[right]) wins += 1;
      else if (probabilities[left] === probabilities[right]) wins += 0.5;
    }
  }
  return wins / (positives * negatives);
}

/**
 * Slope of labels regressed on logit(predictions). 1 is perfect; below 1 means the
 * predictions are too extreme to be trusted.
 */
export function calibrationSlope(
  labels: readonly number[],
  probabilities: readonly number[],
): number {
  if (labels.length < 10) return 1;
  try {
    const design = probabilities.map((probability) => [1, logit(probability)]);
    const fit = fitLogistic(
      design,
      labels,
      new Array<number>(labels.length).fill(0),
      [10, 10],
    );
    const slope = fit.beta[1];
    return Number.isFinite(slope) ? slope : 1;
  } catch {
    return 1;
  }
}

/** One reliability row for the model page. */
export interface ReliabilityRow {
  lower: number;
  upper: number;
  count: number;
  predicted: number;
  observed: number;
}

/** Equal-width reliability table; empty bins are omitted. */
export function reliabilityTable(
  labels: readonly number[],
  probabilities: readonly number[],
  bins = 10,
): ReliabilityRow[] {
  const counts = new Array<number>(bins).fill(0);
  const predicted = new Array<number>(bins).fill(0);
  const observed = new Array<number>(bins).fill(0);
  for (let index = 0; index < labels.length; index += 1) {
    const bin = Math.min(bins - 1, Math.floor(probabilities[index] * bins));
    counts[bin] += 1;
    predicted[bin] += probabilities[index];
    observed[bin] += labels[index];
  }
  const rows: ReliabilityRow[] = [];
  for (let bin = 0; bin < bins; bin += 1) {
    if (counts[bin] === 0) continue;
    rows.push({
      lower: bin / bins,
      upper: (bin + 1) / bins,
      count: counts[bin],
      predicted: predicted[bin] / counts[bin],
      observed: observed[bin] / counts[bin],
    });
  }
  return rows;
}
