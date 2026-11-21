/**
 * Slider fill geometry.
 * Inputs: a slider value and its inclusive bounds.
 * Outputs: the width of the ink fill bar as a percentage of the track.
 * Invariants: the result is always finite and between 0 and 100; an empty or
 * invalid range returns 0 so the fill bar never extends past the track.
 */

/**
 * Returns the percentage of a slider track that should be filled.
 *
 * @param value - Current slider value.
 * @param min - Lowest allowed value.
 * @param max - Highest allowed value.
 * @returns A number from 0 to 100. Returns 0 when `max` is not greater than
 * `min` or when any input is not finite.
 */
export function sliderFillPercent(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) {
    return 0;
  }
  if (max <= min) return 0;

  const percent = ((value - min) / (max - min)) * 100;
  return Math.min(100, Math.max(0, percent));
}
