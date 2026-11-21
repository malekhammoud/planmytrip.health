/**
 * Trip headline sentence builder for PlanMyTrip.health.
 *
 * Inputs: a destination label, a trip length, and a condition identifier. Outputs:
 * one calm sentence such as "4 days in Tokyo, Japan, paced for asthma or respiratory
 * conditions." Invariants: pure and deterministic; the destination is trimmed; an empty
 * destination becomes "your destination" so the interface never shows a dangling comma.
 * The sentence is descriptive only and is not medical advice.
 */

import { CONDITION_LABELS, type Condition } from "./types";

/** Inputs for {@link describeTrip}. */
export interface DescribeTripInput {
  /** Free-text destination label. It is trimmed before use. */
  destination: string;
  /** Trip length in whole days, as chosen in the constraint rail. */
  days: number;
  /** The selected condition identifier. */
  condition: Condition;
}

/**
 * Build the headline sentence for a planned trip. The destination is trimmed and
 * an empty label falls back to "your destination"; the condition label comes from
 * CONDITION_LABELS so the page and the rail stay in one vocabulary.
 */
export function describeTrip({ destination, days, condition }: DescribeTripInput): string {
  const place = destination.trim() || "your destination";
  return `${days} days in ${place}, paced for ${CONDITION_LABELS[condition]}.`;
}
