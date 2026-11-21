/**
 * Deterministic itinerary construction for the health pacing engine.
 *
 * Inputs: validated trip days, a condition profile, condition, destination label, and
 * medication label. Outputs: HealthTripDay[] with generic activity blocks, caps,
 * pacing rules, and condition-aware checkpoints. Invariants: no invented venues, every
 * block label carries the destination, every day supplies the profile's full recovery
 * minutes, and every day is checked against its own modeled step and walking caps.
 */

import type { Condition } from "./types";
import {
  HealthTripInputError,
  TRIP_DAYS_MAX,
  TRIP_DAYS_MIN,
  type BlockKind,
  type ConditionProfile,
  type Exertion,
  type HealthTripDay,
  type ItineraryBlock,
} from "./healthTripTypes";
import { modelDayLoad } from "./healthScore";

/**
 * Typed pacing policy shared by the builder and tests. "Lighter" means a smaller cap
 * than a middle day. A 2-day trip's final cap (0.4) is also below its first day (0.45).
 */
export interface PacingPolicy {
  readonly firstDayCapFactor: number;
  readonly middleDayCapFactor: number;
  readonly finalDayCapFactor: number;
}

/** Single source for day cap factors. */
export const PACING_POLICY = {
  firstDayCapFactor: 0.45,
  middleDayCapFactor: 0.8,
  finalDayCapFactor: 0.4,
} as const satisfies PacingPolicy;

const MIDDLE_DAY_TITLES = [
  "Low-exertion cultural pacing",
  "Steady cultural pacing",
  "Quiet cultural pacing",
] as const;

const CONDITION_CHECKPOINTS: Readonly<Record<Condition, string>> = {
  asthma_respiratory:
    "Pause if breathing feels harder than usual; keep the prescribed reliever within reach.",
  chronic_fatigue_pots:
    "Sit down and raise your feet if you feel lightheaded; drink water before moving again.",
  pregnancy_second_trimester:
    "Rest and hydrate; note new swelling, headache, or dizziness and contact your clinician if unsure.",
  severe_food_allergy:
    "Confirm ingredients with staff; keep prescribed emergency medication within reach.",
  cardiac_hypertension:
    "Rest and check for chest discomfort or unusual breathlessness; stop and seek care if it appears.",
};

type DayPhase = "first" | "middle" | "final";

function block(
  kind: BlockKind,
  label: string,
  durationMin: number,
  exertion: Exertion,
): ItineraryBlock {
  return { kind, label, durationMin, exertion };
}

function recoveryBlock(
  profile: ConditionProfile,
  destination: string,
): ItineraryBlock {
  const label = profile.mandatoryAfternoonRecovery
    ? `Afternoon recovery window: rest, hydrate, symptom check in ${destination}`
    : `Recovery buffer: rest and hydrate in ${destination}`;
  return block("recovery", label, profile.recoveryMinutes, 1);
}

function buildPacingRule(
  phase: DayPhase,
  profile: ConditionProfile,
  stepCap: number,
  walkingCapKm: number,
): string {
  const limits = `Keep the day at or below ${stepCap} steps and ${walkingCapKm.toFixed(2)} km.`;
  const environment = `Stay below ${profile.altitude.maxMeters} m and out of heat above ${profile.heat.cautionAboveCelsius}°C.`;
  if (phase === "first") {
    return `${limits} Reset sleep first, then confirm pharmacy and hospital routes. ${environment}`;
  }
  if (phase === "final") {
    return `${limits} Keep the return transfer unhurried and keep the recovery window. ${environment}`;
  }
  return profile.mandatoryAfternoonRecovery
    ? `${limits} Place the afternoon recovery between cultural blocks. ${environment}`
    : `${limits} Place the recovery buffer between cultural blocks. ${environment}`;
}

function buildHealthCheckpoint(
  condition: Condition,
  profile: ConditionProfile,
  destination: string,
  phase: DayPhase,
): string {
  const base = CONDITION_CHECKPOINTS[condition];
  const allergens = profile.allergens.note;
  if (phase === "first") {
    return `${base} Confirm pharmacy and hospital routes in ${destination}. ${allergens}`;
  }
  if (phase === "final") {
    return `${base} Keep the return transfer in ${destination} unhurried and your medication within reach. ${allergens}`;
  }
  return `${base} Note the pharmacy route in ${destination} before the next block. ${allergens}`;
}

function dayBlocks(
  phase: DayPhase,
  profile: ConditionProfile,
  destination: string,
  medication: string,
): ItineraryBlock[] {
  if (phase === "first") {
    return [
      block("acclimation", `Sleep-reset window in ${destination}: dim room and no screens`, 20, 1),
      block("acclimation", `Locate the nearest pharmacy and hospital in ${destination}`, 20, 1),
      block(
        "acclimation",
        medication
          ? `Medication stock check for ${medication} and pharmacy route review in ${destination}`
          : `Medication stock check and pharmacy route review in ${destination}`,
        15,
        1,
      ),
      block("meal", `Unhurried meal near the hotel in ${destination}`, 30, 1),
      recoveryBlock(profile, destination),
    ];
  }
  if (phase === "final") {
    return [
      block("transit", `Short local transit in ${destination}`, 15, 2),
      block("cultural", `Low-exertion indoor cultural visit in ${destination}`, 45, 1),
      block("meal", `Unhurried meal near the hotel in ${destination}`, 30, 1),
      recoveryBlock(profile, destination),
      block("transit", `Return transfer from the hotel in ${destination}`, 15, 2),
    ];
  }
  return [
    block("transit", `Short local transit in ${destination}`, 15, 2),
    block("cultural", `Low-exertion indoor cultural visit in ${destination}`, 60, 1),
    block("meal", `Unhurried lunch near the hotel in ${destination}`, 30, 1),
    recoveryBlock(profile, destination),
    block("cultural", `Gentle outdoor cultural stroll in ${destination}`, 20, 2),
    block("meal", `Unhurried dinner near the hotel in ${destination}`, 45, 1),
  ];
}

function buildDay(
  dayNumber: number,
  days: number,
  profile: ConditionProfile,
  condition: Condition,
  destination: string,
  medication: string,
): HealthTripDay {
  const phase: DayPhase =
    dayNumber === 1 ? "first" : dayNumber === days ? "final" : "middle";
  const factor =
    phase === "first"
      ? PACING_POLICY.firstDayCapFactor
      : phase === "final"
        ? PACING_POLICY.finalDayCapFactor
        : PACING_POLICY.middleDayCapFactor;
  const stepCap = Math.floor(profile.dailyStepCeiling * factor);
  const walkingCapKm = Math.ceil(profile.maxWalkingKm * factor * 100) / 100;
  const title =
    phase === "first"
      ? `Acclimation and pharmacy setup in ${destination}`
      : phase === "final"
        ? `Lighter final day in ${destination}`
        : `${MIDDLE_DAY_TITLES[(dayNumber - 2) % MIDDLE_DAY_TITLES.length]} in ${destination}`;
  const day: HealthTripDay = {
    day: dayNumber,
    title,
    stepCap,
    walkingCapKm,
    pacingRule: buildPacingRule(phase, profile, stepCap, walkingCapKm),
    blocks: dayBlocks(phase, profile, destination, medication),
    healthCheckpoint: buildHealthCheckpoint(
      condition,
      profile,
      destination,
      phase,
    ),
  };
  modelDayLoad(day);
  return day;
}

/**
 * Build the paced itinerary. `days` must be an integer from TRIP_DAYS_MIN to
 * TRIP_DAYS_MAX; a direct invalid call throws HealthTripInputError. Every completed day
 * is checked by modelDayLoad against its own caps.
 */
export function buildItinerary(
  days: number,
  profile: ConditionProfile,
  condition: Condition,
  destination: string,
  medication: string,
): HealthTripDay[] {
  if (!Number.isInteger(days) || days < TRIP_DAYS_MIN || days > TRIP_DAYS_MAX) {
    throw new HealthTripInputError(
      "invalid_days",
      "days",
      `Days must be a whole number from ${TRIP_DAYS_MIN} to ${TRIP_DAYS_MAX}.`,
    );
  }
  return Array.from({ length: days }, (_, index) =>
    buildDay(index + 1, days, profile, condition, destination, medication),
  );
}
