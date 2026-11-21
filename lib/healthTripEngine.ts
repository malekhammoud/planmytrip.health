/**
 * Public entry point for the PlanMyTrip.health biological pacing engine.
 *
 * Inputs: HealthTripInput. Outputs: HealthTripPlan plus every public engine symbol.
 * Invariants: pure and deterministic; no I/O, Date, Math.random, or locale output. All
 * modeled physiological limits live in CONDITION_PROFILES; this module validates input,
 * orchestrates the split modules, and re-exports the public API. This is a planning aid,
 * not medical advice; scores are modeled estimates, never clinical validation.
 */

import { isCondition } from "./types";
import { CONDITION_PROFILES } from "./conditionProfiles";
import { buildItinerary } from "./itineraryBuilder";
import { computeHealthScores } from "./healthScore";
import { checkSunLifeCoverage } from "./sunLifeRules";
import {
  HealthTripInputError,
  TRIP_DAYS_MAX,
  TRIP_DAYS_MIN,
  type HealthTripInput,
  type HealthTripPlan,
} from "./healthTripTypes";

function normalizeAndValidateInput(input: HealthTripInput): {
  destination: string;
  medication: string;
} {
  const destination =
    typeof input?.destination === "string" ? input.destination.trim() : "";
  if (!destination) {
    throw new HealthTripInputError(
      "invalid_destination",
      "destination",
      "Destination must be a non-empty label.",
    );
  }
  if (
    !Number.isInteger(input.days) ||
    input.days < TRIP_DAYS_MIN ||
    input.days > TRIP_DAYS_MAX
  ) {
    throw new HealthTripInputError(
      "invalid_days",
      "days",
      `Days must be a whole number from ${TRIP_DAYS_MIN} to ${TRIP_DAYS_MAX}.`,
    );
  }
  if (!isCondition(input.condition)) {
    throw new HealthTripInputError(
      "invalid_condition",
      "condition",
      "Condition must be one of the supported condition identifiers.",
    );
  }
  if (typeof input.medication !== "string") {
    throw new HealthTripInputError(
      "invalid_medication",
      "medication",
      "Medication must be a string; an empty value means none recorded.",
    );
  }
  if (typeof input.hasSunLifeTravelCoverage !== "boolean") {
    throw new HealthTripInputError(
      "invalid_coverage",
      "hasSunLifeTravelCoverage",
      "Coverage must be a boolean.",
    );
  }
  return {
    destination: destination.replace(/\s+/g, " "),
    medication: input.medication.trim().replace(/\s+/g, " "),
  };
}

/**
 * Build the complete deterministic plan for one input. Throws HealthTripInputError
 * with a stable code and field when the input is invalid.
 */
export function buildHealthTripPlan(input: HealthTripInput): HealthTripPlan {
  const { destination, medication } = normalizeAndValidateInput(input);
  const profile = CONDITION_PROFILES[input.condition];
  const itinerary = buildItinerary(
    input.days,
    profile,
    input.condition,
    destination,
    medication,
  );
  return {
    ...computeHealthScores(itinerary, profile, input.days),
    dailyStepCeiling: profile.dailyStepCeiling,
    sunLifeAlert: checkSunLifeCoverage(
      input.days,
      input.hasSunLifeTravelCoverage,
    ),
    itinerary,
  };
}

export {
  HealthTripInputError,
  ItineraryInvariantError,
  TRIP_DAYS_MAX,
  TRIP_DAYS_MIN,
} from "./healthTripTypes";
export type {
  AllergenConstraint,
  AltitudeConstraint,
  BlockKind,
  ConditionProfile,
  DayLoad,
  Exertion,
  HealthTripDay,
  HealthTripInput,
  HealthTripInputErrorCode,
  HealthTripPlan,
  HeatConstraint,
  ItineraryBlock,
  ItineraryInvariantErrorCode,
  SunLifeAlert,
  SunLifeSeverity,
} from "./healthTripTypes";
export {
  CONDITION_PROFILES,
  DEFAULT_MEDICATION_BY_CONDITION,
  MEDICATION_DISCLAIMER,
} from "./conditionProfiles";
export {
  SUN_LIFE_RULES,
  SUN_LIFE_STABILITY_WINDOW_DAYS_PLACEHOLDER,
  checkSunLifeCoverage,
} from "./sunLifeRules";
export {
  MODELED_LOAD_ASSUMPTIONS,
  computeHealthScores,
  modelDayLoad,
} from "./healthScore";
export { PACING_POLICY, buildItinerary } from "./itineraryBuilder";
export type { PacingPolicy } from "./itineraryBuilder";
