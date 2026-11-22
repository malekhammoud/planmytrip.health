/**
 * Modeled load and deterministic safety scoring for the health pacing engine.
 *
 * Inputs: an itinerary, condition profile, and trip days. Outputs:
 * MODELED_LOAD_ASSUMPTIONS, modelDayLoad, and computeHealthScores. Invariants: pure and
 * deterministic; scores are integers 0-100; modeled estimates, never clinical validation.
 */

import {
  ItineraryInvariantError,
  TRIP_DAYS_MIN,
  type ConditionProfile,
  type DayLoad,
  type HealthTripDay,
  type HealthTripPlan,
} from "./healthTripTypes";

/**
 * Modeled load assumptions. These are product assumptions, not physiological
 * thresholds; physiological limits live in CONDITION_PROFILES. `kmPerStep` is a
 * conservative 0.5 m stride used only to convert modeled steps to distance, not a
 * clinical measure.
 */
/** The trip length at which modeled trip-length pressure saturates. */
const TRIP_LENGTH_PRESSURE_DAYS = 7;

export const MODELED_LOAD_ASSUMPTIONS = {
  stepsPerExertionMinute: { 1: 6, 2: 26, 3: 55 },
  kmPerStep: 0.0005,
  baselineStepsPerDay: 10000,
  baselineWalkingKmPerDay: 8,
  baselineExertion: 2.2,
  baselineExposureNormalization: 2,
  plannedExposureFreeShare: 0.5,
  plannedWeights: { exposure: 0.45, exertion: 0.2, recoveryGap: 0.2, tripLength: 0.15 },
  baselineWeights: { exposure: 0.55, exertion: 0.2, recoveryGap: 0.15, tripLength: 0.1 },
} as const;

/**
 * Model the steps, walking, exertion, and recovery carried by one day. Only
 * acclimation, cultural, and transit blocks contribute walking steps; meals and
 * recovery contribute zero. Throws ItineraryInvariantError if the modeled load
 * exceeds the day's own caps.
 */
export function modelDayLoad(day: HealthTripDay): DayLoad {
  let steps = 0;
  let activeMinutes = 0;
  let exertionWeightedMinutes = 0;
  let recoveryMinutes = 0;
  for (const item of day.blocks) {
    const contributesWalking =
      item.kind === "acclimation" ||
      item.kind === "cultural" ||
      item.kind === "transit";
    if (contributesWalking) {
      steps +=
        item.durationMin *
        MODELED_LOAD_ASSUMPTIONS.stepsPerExertionMinute[item.exertion];
    }
    activeMinutes += item.durationMin;
    exertionWeightedMinutes += item.durationMin * item.exertion;
    if (item.kind === "recovery") recoveryMinutes += item.durationMin;
  }
  const walkingKm =
    Math.round(steps * MODELED_LOAD_ASSUMPTIONS.kmPerStep * 1000) / 1000;
  if (steps > day.stepCap) {
    throw new ItineraryInvariantError(
      "steps_exceed_cap",
      day.day,
      `Day ${day.day} models ${steps} steps above its cap of ${day.stepCap}.`,
    );
  }
  if (walkingKm > day.walkingCapKm) {
    throw new ItineraryInvariantError(
      "walking_exceed_cap",
      day.day,
      `Day ${day.day} models ${walkingKm} km above its cap of ${day.walkingCapKm} km.`,
    );
  }
  return {
    steps,
    walkingKm,
    activeMinutes,
    exertionWeightedMinutes,
    recoveryMinutes,
  };
}

function clampRatio(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Deterministic modeled score. This is not clinically validated.
 *
 * Baseline: a standard sightseeing day of 10,000 steps, 8 km, and exertion 2.2 with
 * no recovery, repeated across the trip. Planned exposure: the highest daily share of
 * the condition's step or walking ceiling; exposure pressure starts above half of that
 * ceiling. Exertion load is duration-weighted 1-3, normalized from rest to hard; the
 * condition ceiling is enforced through the step and walking exposure. Recovery
 * coverage compares planned recovery minutes with recoveryMinutes x days.
 * Trip-length pressure rises from 0 at 2 days to 1 at 7 days and stays saturated for
 * longer supported trips. Planned pressure weights
 * exposure 45%, exertion 20%, recovery gap 20%, and trip length 15%. Safety =
 * 100 - (residualRiskFloor + (100 - floor) * pressure). Baseline uses weights
 * 55/20/15/10, the same floor, and no recovery. riskReductionPct =
 * (healthSafetyScore - baselineScore) / (100 - baselineScore) * 100, clamped 0-100.
 */
export function computeHealthScores(
  itinerary: HealthTripDay[],
  profile: ConditionProfile,
  days: number,
): Pick<HealthTripPlan, "healthSafetyScore" | "baselineScore" | "riskReductionPct"> {
  const assumptions = MODELED_LOAD_ASSUMPTIONS;
  const loads = itinerary.map(modelDayLoad);
  const peakExposure = Math.max(
    ...loads.map((load) => load.steps / profile.dailyStepCeiling),
    ...loads.map((load) => load.walkingKm / profile.maxWalkingKm),
  );
  const exposurePressure = clampRatio(
    (peakExposure - assumptions.plannedExposureFreeShare) /
      (1 - assumptions.plannedExposureFreeShare),
  );
  const activeMinutes = loads.reduce((sum, load) => sum + load.activeMinutes, 0);
  const exertion = loads.reduce((sum, load) => sum + load.exertionWeightedMinutes, 0);
  const exertionPressure = clampRatio(((activeMinutes > 0 ? exertion / activeMinutes : 1) - 1) / 2);
  const recoveryGap =
    1 -
    clampRatio(
      loads.reduce((sum, load) => sum + load.recoveryMinutes, 0) /
        Math.max(1, profile.recoveryMinutes * days),
    );
  const tripLengthPressure = clampRatio(
    (Math.min(days, TRIP_LENGTH_PRESSURE_DAYS) - TRIP_DAYS_MIN) /
      (TRIP_LENGTH_PRESSURE_DAYS - TRIP_DAYS_MIN),
  );
  const plannedPressure = clampRatio(
    assumptions.plannedWeights.exposure * exposurePressure +
      assumptions.plannedWeights.exertion * exertionPressure +
      assumptions.plannedWeights.recoveryGap * recoveryGap +
      assumptions.plannedWeights.tripLength * tripLengthPressure,
  );
  const plannedRisk =
    profile.residualRiskFloor + (100 - profile.residualRiskFloor) * plannedPressure;
  const healthSafetyScore = clampScore(100 - plannedRisk);

  const baselineLoad = Math.max(
    assumptions.baselineStepsPerDay / profile.dailyStepCeiling,
    assumptions.baselineWalkingKmPerDay / profile.maxWalkingKm,
  );
  const baselineExposure = clampRatio(
    (baselineLoad - 1) / assumptions.baselineExposureNormalization,
  );
  const baselinePressure = clampRatio(
    assumptions.baselineWeights.exposure * baselineExposure +
      assumptions.baselineWeights.exertion *
        clampRatio((assumptions.baselineExertion - 1) / 2) +
      assumptions.baselineWeights.recoveryGap +
      assumptions.baselineWeights.tripLength * tripLengthPressure,
  );
  const baselineRisk =
    profile.residualRiskFloor + (100 - profile.residualRiskFloor) * baselinePressure;
  const baselineScore = clampScore(100 - baselineRisk);
  const riskReductionPct = clampScore(
    ((healthSafetyScore - baselineScore) / Math.max(1, 100 - baselineScore)) * 100,
  );
  return { healthSafetyScore, baselineScore, riskReductionPct };
}
