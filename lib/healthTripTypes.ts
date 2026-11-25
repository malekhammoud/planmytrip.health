/**
 * Shared types for the health pacing engine and its split modules.
 *
 * Inputs: none. Outputs: HealthTripInput, the typed input error, condition constraints,
 * itinerary blocks and days, plan output, and day-load output.
 * Invariant: every condition profile, itinerary day, and plan in lib/ uses these types.
 */

import type { Condition } from "./types";

/** Inclusive lower bound for a supported trip length. */
export const TRIP_DAYS_MIN = 2;

/** Inclusive upper bound for a supported trip length. */
export const TRIP_DAYS_MAX = 20;

/** Caller-supplied plan inputs. The destination is a display label only. */
export interface HealthTripInput {
  destination: string;
  days: number;
  condition: Condition;
}

/** Stable machine-readable reasons a plan input was rejected. */
export type HealthTripInputErrorCode =
  | "invalid_destination"
  | "invalid_days"
  | "invalid_condition";

/**
 * Typed validation error. `code` is stable for callers; `field` names the offending
 * input property. Use this instead of a bare Error so the interface can map errors.
 */
export class HealthTripInputError extends Error {
  constructor(
    readonly code: HealthTripInputErrorCode,
    readonly field: keyof HealthTripInput,
    message: string,
  ) {
    super(message);
    this.name = "HealthTripInputError";
  }
}

/** Stable reasons a generated day failed its own modeled caps. */
export type ItineraryInvariantErrorCode =
  | "steps_exceed_cap"
  | "walking_exceed_cap";

/**
 * Thrown when a generated day violates its own modeled step or walking cap. This
 * protects the cap invariant from profile or template drift; tests can also raise it
 * with a deliberately low synthetic profile.
 */
export class ItineraryInvariantError extends Error {
  constructor(
    readonly code: ItineraryInvariantErrorCode,
    readonly day: number,
    message: string,
  ) {
    super(message);
    this.name = "ItineraryInvariantError";
  }
}

/** Modeled altitude limit and why it matters. */
export interface AltitudeConstraint {
  readonly maxMeters: number;
  readonly note: string;
}

/** Modeled heat caution threshold and why it matters. */
export interface HeatConstraint {
  readonly cautionAboveCelsius: number;
  readonly note: string;
}

/** Allergen or food-safety constraints and a short note. */
export interface AllergenConstraint {
  readonly avoid: readonly string[];
  readonly note: string;
}

/** One typed condition profile. All values are conservative modeling limits. */
export interface ConditionProfile {
  readonly dailyStepCeiling: number;
  readonly maxWalkingKm: number;
  readonly mandatoryAfternoonRecovery: boolean;
  readonly recoveryMinutes: number;
  readonly altitude: AltitudeConstraint;
  readonly heat: HeatConstraint;
  readonly allergens: AllergenConstraint;
  /**
   * Minimum modeled residual risk (0-100) retained even under perfect pacing.
   * The safety score is capped at 100 minus this value. This is a product
   * modeling assumption, not a clinical measure; include it in the profile's
   * VERIFY line.
   */
  readonly residualRiskFloor: number;
  readonly rationale: string;
}

/** Block kinds used by the pacing strip. */
export type BlockKind = "acclimation" | "cultural" | "recovery" | "meal" | "transit";

/** Modeled exertion levels: 1 is low, 2 is moderate, 3 is high. */
export type Exertion = 1 | 2 | 3;

/** One itinerary block. Labels are generic templates with the destination interpolated. */
export interface ItineraryBlock {
  kind: BlockKind;
  label: string;
  durationMin: number;
  exertion: Exertion;
}

/** One paced day. Step and walking caps are modeled ceilings, not targets. */
export interface HealthTripDay {
  day: number;
  title: string;
  stepCap: number;
  walkingCapKm: number;
  pacingRule: string;
  blocks: ItineraryBlock[];
  healthCheckpoint: string;
}

/** Complete engine output for the KPI strip and itinerary board. */
export interface HealthTripPlan {
  healthSafetyScore: number;
  baselineScore: number;
  riskReductionPct: number;
  dailyStepCeiling: number;
  itinerary: HealthTripDay[];
}

/** Modeled load recovered from a day's blocks. Used by the score and cap checks. */
export interface DayLoad {
  steps: number;
  walkingKm: number;
  activeMinutes: number;
  exertionWeightedMinutes: number;
  recoveryMinutes: number;
}
