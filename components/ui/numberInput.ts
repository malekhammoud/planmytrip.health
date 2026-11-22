/**
 * Integer field helpers for the duration control.
 *
 * Inputs: a parsed number and the allowed integer range.
 * Outputs: one rounded, clamped integer.
 * Invariants: non-finite values become the minimum; the result never leaves the range.
 */

/** Rounds and clamps an integer to the inclusive range. */
export function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
