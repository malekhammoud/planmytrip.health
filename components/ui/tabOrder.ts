/**
 * Keyboard index helper for the Paper and Ink tab bar.
 *
 * Inputs: the current tab index, a keyboard key, and the number of tabs.
 * Outputs: the next focusable index, wrapping at both ends.
 * Invariants: the result is always a valid index for a non-empty tab list; unknown keys
 * leave the current index unchanged.
 */

/** Returns the next tab index for ArrowLeft, ArrowRight, Home, and End. */
export function nextTabIndex(
  current: number,
  key: string,
  length: number,
): number {
  if (length <= 0) return 0;
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  if (key === "ArrowRight") return (current + 1) % length;
  if (key === "ArrowLeft") return (current - 1 + length) % length;
  return current;
}
