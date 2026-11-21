/**
 * Shared fixtures for the Step 3 pacing-engine tests.
 *
 * Inputs: none. Outputs: BASE_INPUT, TRIP_LENGTHS, and planFor. Invariants: the base
 * input is valid; tests override fields only when asserting rejection behavior.
 */

import type { Condition } from "@/lib/types";
import {
  buildHealthTripPlan,
  DEFAULT_MEDICATION_BY_CONDITION,
  type HealthTripInput,
} from "@/lib/healthTripEngine";

/** Valid baseline input used across the engine test files. */
export const BASE_INPUT: HealthTripInput = {
  destination: "Tokyo, Japan",
  days: 4,
  condition: "asthma_respiratory",
  medication: "albuterol",
  hasSunLifeTravelCoverage: true,
};

/** Every supported trip length, in the required order. */
export const TRIP_LENGTHS = [2, 3, 4, 5, 6, 7] as const;

/** Build a plan with a valid default medication for the requested condition. */
export function planFor(
  condition: Condition,
  days: number,
  overrides: Partial<HealthTripInput> = {},
) {
  return buildHealthTripPlan({
    ...BASE_INPUT,
    condition,
    days,
    medication: DEFAULT_MEDICATION_BY_CONDITION[condition],
    ...overrides,
  });
}
