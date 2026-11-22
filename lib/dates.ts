/**
 * Small ISO date helpers shared by onboarding, the planner request, and venue jobs.
 *
 * Inputs: a `YYYY-MM-DD` string and an optional day offset.
 * Outputs: validation or a UTC-shifted `YYYY-MM-DD` string.
 * Invariants: no time zone, clock, or locale is read; malformed and impossible dates are
 * rejected rather than rolled over.
 */

/** True only for a real calendar date in `YYYY-MM-DD` form. */
export function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Adds whole days to an ISO date, returning null when the input is invalid. */
export function addDaysIso(value: string, days: number): string | null {
  if (!isIsoDate(value) || !Number.isFinite(days)) return null;
  const date = new Date(`${value.trim()}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + Math.trunc(days));
  return date.toISOString().slice(0, 10);
}
