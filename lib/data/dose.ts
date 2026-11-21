/**
 * Deterministic dose computation for both plan families.
 *
 * Inputs: engine itinerary days, or concierge/fallback plan days with their places, plus
 * the condition profile. Outputs: PlannedDose rows and the model's feature row.
 * Invariants: the dose is derived from block kind, duration, and exertion only; an
 * agent's stepEstimate is never read; an empty day is flagged unsafe; a rest day with a
 * real recovery block may legitimately carry zero steps.
 */

import type {
  PlannerDay,
  PlannerPlace,
  PlanBlockKind,
} from "../agent/agentTypes";
import { CONDITION_PROFILES } from "../conditionProfiles";
import { MODELED_LOAD_ASSUMPTIONS } from "../healthScore";
import {
  type ConditionProfile,
  type Exertion,
  type HealthTripDay,
} from "../healthTripTypes";
import type { Condition } from "../types";
import type {
  AdherenceLevel,
  PlannedDose,
  TripFeatures,
} from "./types";

/** Kinds that carry walking steps. Stay, meal, and rest do not, matching the engine. */
const WALKING_KINDS: ReadonlySet<PlanBlockKind> = new Set([
  "transit",
  "visit",
  "hike",
  "care",
]);

/** Base exertion per concierge block kind, before place-specific hike adjustment. */
// VERIFY: block-kind exertion and the 8 km / 350 m hike thresholds are product assumptions,
// not clinical limits. Confirm the walking contribution of visits, transit, and care blocks.
const BASE_EXERTION: Readonly<Record<PlanBlockKind, Exertion>> = {
  transit: 2,
  stay: 1,
  meal: 1,
  visit: 1,
  hike: 2,
  rest: 1,
  care: 1,
};

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function hikeExertion(place: PlannerPlace | null): Exertion {
  if (place === null) return 2;
  const distance = place.distanceKm ?? 0;
  const elevation = place.elevationM ?? 0;
  const difficulty = (place.difficulty ?? "").toLowerCase();
  if (
    distance >= 8 ||
    elevation >= 350 ||
    difficulty.includes("hard") ||
    difficulty.includes("strenuous")
  ) {
    return 3;
  }
  return 2;
}

/** Exertion for one concierge block; hikes use verified distance and elevation. */
export function blockExertion(
  kind: PlanBlockKind,
  place: PlannerPlace | null,
): Exertion {
  return kind === "hike" ? hikeExertion(place) : BASE_EXERTION[kind];
}

/**
 * Computes the prescribed dose for concierge and fallback days. The agent's
 * `stepEstimate` and `walkingKm` are intentionally ignored.
 */
// VERIFY: only `rest` blocks count as recovery; confirm meals, stay, and unplanned pauses
// should not count toward recovery coverage.
export function computePlannerDose(
  days: readonly PlannerDay[],
  places: readonly PlannerPlace[],
  source: "concierge" | "fallback",
): PlannedDose[] {
  const byId = new Map(places.map((place) => [place.id, place]));
  return days.map((day) => {
    let steps = 0;
    let activeMinutes = 0;
    let exertionWeightedMinutes = 0;
    let recoveryMinutes = 0;
    for (const block of day.blocks) {
      const exertion = blockExertion(
        block.kind,
        block.placeId === null ? null : byId.get(block.placeId) ?? null,
      );
      activeMinutes += block.durationMin;
      exertionWeightedMinutes += block.durationMin * exertion;
      if (WALKING_KINDS.has(block.kind)) {
        steps +=
          block.durationMin *
          MODELED_LOAD_ASSUMPTIONS.stepsPerExertionMinute[exertion];
      }
      if (block.kind === "rest") recoveryMinutes += block.durationMin;
    }
    const walkingKm = round3(steps * MODELED_LOAD_ASSUMPTIONS.kmPerStep);
    const empty = day.blocks.length === 0;
    const withinCaps =
      !empty && steps <= day.stepCeiling && walkingKm <= day.walkingCapKm;
    return {
      day: day.day,
      steps,
      walkingKm,
      activeMinutes,
      exertionWeightedMinutes,
      recoveryMinutes,
      stepCeiling: day.stepCeiling,
      walkingCapKm: day.walkingCapKm,
      withinCaps,
      empty,
      source,
    };
  });
}

/**
 * Computes the engine itinerary's dose with the engine's own load model, so the two
 * plan families are directly comparable. The engine guarantees its own caps.
 */
export function computeEngineDose(itinerary: readonly HealthTripDay[]): PlannedDose[] {
  return itinerary.map((day) => {
    let steps = 0;
    let activeMinutes = 0;
    let exertionWeightedMinutes = 0;
    let recoveryMinutes = 0;
    for (const block of day.blocks) {
      const contributesWalking =
        block.kind === "acclimation" ||
        block.kind === "cultural" ||
        block.kind === "transit";
      if (contributesWalking) {
        steps +=
          block.durationMin *
          MODELED_LOAD_ASSUMPTIONS.stepsPerExertionMinute[block.exertion];
      }
      activeMinutes += block.durationMin;
      exertionWeightedMinutes += block.durationMin * block.exertion;
      if (block.kind === "recovery") recoveryMinutes += block.durationMin;
    }
    const walkingKm = round3(steps * MODELED_LOAD_ASSUMPTIONS.kmPerStep);
    const empty = day.blocks.length === 0;
    return {
      day: day.day,
      steps,
      walkingKm,
      activeMinutes,
      exertionWeightedMinutes,
      recoveryMinutes,
      stepCeiling: day.stepCap,
      walkingCapKm: day.walkingCapKm,
      withinCaps:
        !empty && steps <= day.stepCap && walkingKm <= day.walkingCapKm,
      empty,
      source: "engine" as const,
    };
  });
}

/** Coarse adherence multiplier used when only a self-report is available. */
export function adherenceMultiplier(level: AdherenceLevel | null): number | null {
  switch (level) {
    case "less":
      return 0.75;
    case "same":
      return 1;
    case "more":
      return 1.25;
    default:
      return null;
  }
}

/** Inputs for the v0 feature row. */
export interface FeatureInput {
  dose: readonly PlannedDose[];
  profile: ConditionProfile;
  days: number;
  places?: readonly PlannerPlace[];
  adherence?: number | null;
  baselineBurden?: number | null;
  heatFlag?: boolean;
}

/**
 * Builds the model feature row. Peak exposure is relative to the condition ceiling, so
 * days and plans with different caps stay comparable.
 */
export function computeTripFeatures(input: FeatureInput): TripFeatures {
  const { dose, profile, days } = input;
  let peakExposure = 0;
  let recoveryMinutes = 0;
  for (const day of dose) {
    peakExposure = Math.max(
      peakExposure,
      day.steps / Math.max(1, profile.dailyStepCeiling),
      day.walkingKm / Math.max(1, profile.maxWalkingKm),
    );
    recoveryMinutes += day.recoveryMinutes;
  }
  const requiredRecovery = Math.max(1, profile.recoveryMinutes * days);
  const altitudeExceeded = (input.places ?? []).some(
    (place) => (place.elevationM ?? 0) > profile.altitude.maxMeters,
  );
  return {
    peakExposure: round3(peakExposure),
    recoveryCoverage: round3(Math.min(1, recoveryMinutes / requiredRecovery)),
    tripLength: days,
    adherence: input.adherence ?? null,
    heatFlag: input.heatFlag === true ? 1 : 0,
    altitudeFlag: altitudeExceeded ? 1 : 0,
    baselineBurden: input.baselineBurden ?? null,
  };
}

/** Convenience for callers that hold a condition id rather than its profile. */
export function profileFor(condition: Condition): ConditionProfile {
  return CONDITION_PROFILES[condition];
}
