/**
 * Small numerical helpers for the calibration model.
 *
 * Inputs: plain number arrays and matrices. Outputs: sigmoid/logit, dot products,
 * Gaussian elimination with partial pivoting, matrix inverse, and quadratic forms.
 * Invariants: no dependencies; singular systems throw instead of returning NaN; all
 * probability helpers clamp away from 0 and 1.
 */

/** Clamps a number to an inclusive range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Logistic function. */
export function sigmoid(value: number): number {
  if (value >= 0) {
    const z = Math.exp(-value);
    return 1 / (1 + z);
  }
  const z = Math.exp(value);
  return z / (1 + z);
}

/** Log-odds, clamped to a finite range. */
export function logit(probability: number): number {
  const p = clamp(probability, 1e-6, 1 - 1e-6);
  return Math.log(p / (1 - p));
}

/** Dot product of two equal-length vectors. */
export function dot(left: readonly number[], right: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < left.length; i += 1) sum += left[i] * right[i];
  return sum;
}

/** Arithmetic mean; returns 0 for an empty list. */
export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

/** Population standard deviation; returns 0 for fewer than two values. */
export function std(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const average = mean(values);
  let sum = 0;
  for (const value of values) sum += (value - average) ** 2;
  return Math.sqrt(sum / values.length);
}

/** Identity matrix. */
export function identity(size: number): number[][] {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => (row === column ? 1 : 0)),
  );
}

/** Matrix-vector product. */
export function matVec(
  matrix: readonly (readonly number[])[],
  vector: readonly number[],
): number[] {
  return matrix.map((row) => dot(row, vector));
}

/**
 * Solves `A x = b` with Gaussian elimination and partial pivoting.
 * Throws on a singular or near-singular matrix so callers never fit NaNs.
 */
export function solveLinearSystem(
  matrix: readonly (readonly number[])[],
  vector: readonly number[],
): number[] {
  const size = matrix.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) {
        pivot = row;
      }
    }
    if (Math.abs(augmented[pivot][column]) < 1e-12) {
      throw new Error("singular matrix");
    }
    if (pivot !== column) {
      const swap = augmented[pivot];
      augmented[pivot] = augmented[column];
      augmented[column] = swap;
    }
    const diagonal = augmented[column][column];
    for (let index = column; index <= size; index += 1) {
      augmented[column][index] /= diagonal;
    }
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      if (factor === 0) continue;
      for (let index = column; index <= size; index += 1) {
        augmented[row][index] -= factor * augmented[column][index];
      }
    }
  }
  return augmented.map((row) => row[size]);
}

/** Matrix inverse via one solve per unit vector. */
export function inverse(matrix: readonly (readonly number[])[]): number[][] {
  const size = matrix.length;
  const columns: number[][] = [];
  for (let column = 0; column < size; column += 1) {
    const unit = new Array<number>(size).fill(0);
    unit[column] = 1;
    columns.push(solveLinearSystem(matrix, unit));
  }
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => columns[column][row]),
  );
}

/** `x^T A x` for a square matrix. */
export function quadraticForm(
  vector: readonly number[],
  matrix: readonly (readonly number[])[],
): number {
  return dot(vector, matVec(matrix, vector));
}
