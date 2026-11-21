/**
 * Penalized logistic regression with an engine offset.
 *
 * Inputs: a design matrix whose first column is the intercept, binary labels, an offset
 * per row, and one prior standard deviation per coefficient. Outputs: MAP coefficients
 * and the Laplace covariance.
 * Invariants: the prior keeps small-sample fits finite; a singular Hessian throws; the
 * offset is never learned, so a zero-coefficient artifact reproduces the engine exactly.
 */

import { dot, identity, inverse, sigmoid, solveLinearSystem } from "./math";

/** One fitted model. `beta[0]` is the intercept. */
export interface LogisticFit {
  beta: number[];
  covariance: number[][];
}

function hessianAt(
  design: readonly (readonly number[])[],
  beta: readonly number[],
  offset: readonly number[],
  priorSd: readonly number[],
): number[][] {
  const width = beta.length;
  const hessian = Array.from({ length: width }, () =>
    new Array<number>(width).fill(0),
  );
  for (let row = 0; row < design.length; row += 1) {
    const point = design[row];
    const probability = sigmoid(dot(point, beta) + offset[row]);
    const weight = Math.max(probability * (1 - probability), 1e-6);
    for (let a = 0; a < width; a += 1) {
      for (let b = 0; b < width; b += 1) {
        hessian[a][b] += point[a] * weight * point[b];
      }
    }
  }
  for (let a = 0; a < width; a += 1) {
    hessian[a][a] += 1 / (priorSd[a] * priorSd[a]);
  }
  return hessian;
}

/**
 * Fits the MAP estimate by Newton-Raphson / IRLS. The Hessian includes the Gaussian
 * prior, so the returned covariance is the Laplace approximation.
 */
export function fitLogistic(
  design: readonly (readonly number[])[],
  labels: readonly number[],
  offset: readonly number[],
  priorSd: readonly number[],
): LogisticFit {
  if (design.length === 0) throw new Error("no training rows");
  const width = design[0].length;
  if (labels.length !== design.length || offset.length !== design.length) {
    throw new Error("design, labels, and offset length mismatch");
  }
  if (priorSd.length !== width) throw new Error("prior width mismatch");

  const beta = new Array<number>(width).fill(0);
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const gradient = new Array<number>(width).fill(0);
    const hessian = Array.from({ length: width }, () =>
      new Array<number>(width).fill(0),
    );
    for (let row = 0; row < design.length; row += 1) {
      const point = design[row];
      const probability = sigmoid(dot(point, beta) + offset[row]);
      const weight = Math.max(probability * (1 - probability), 1e-6);
      const residual = labels[row] - probability;
      for (let a = 0; a < width; a += 1) {
        gradient[a] += point[a] * residual;
        for (let b = 0; b < width; b += 1) {
          hessian[a][b] += point[a] * weight * point[b];
        }
      }
    }
    for (let a = 0; a < width; a += 1) {
      gradient[a] -= beta[a] / (priorSd[a] * priorSd[a]);
      hessian[a][a] += 1 / (priorSd[a] * priorSd[a]);
    }
    const step = solveLinearSystem(hessian, gradient);
    let maxStep = 0;
    for (let a = 0; a < width; a += 1) {
      beta[a] += step[a];
      maxStep = Math.max(maxStep, Math.abs(step[a]));
    }
    if (maxStep < 1e-7) break;
  }

  // Recompute the Hessian at the final coefficients so the covariance matches them.
  const covariance = inverse(hessianAt(design, beta, offset, priorSd));
  return { beta, covariance };
}

/** A zero-coefficient fit: the model is exactly the engine offset. */
export function zeroFit(width: number): LogisticFit {
  return { beta: new Array<number>(width).fill(0), covariance: identity(width) };
}
