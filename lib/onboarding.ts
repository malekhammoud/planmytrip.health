/**
 * Trip draft helpers for the onboarding flow.
 *
 * Inputs: a partially edited trip configuration.
 * Outputs: the default draft, a step gate, and a normalized configuration.
 * Invariants: the draft is a label-only planning input; it is never medical advice. The
 * destination is the only hard gate before the health step. Lengths match the API bounds.
 */

import { DEFAULT_MEDICATION_BY_CONDITION } from "@/lib/conditionProfiles";
import { TRIP_DAYS_MAX, TRIP_DAYS_MIN } from "@/lib/healthTripTypes";
import type { TripConfig } from "@/lib/agent/agentTypes";

const DESTINATION_MAX = 120;
const MEDICATION_MAX = 120;
const INTERESTS_MAX = 240;

/** The empty draft shown to a first-time visitor. */
export const DEFAULT_TRIP: TripConfig = {
  destination: "",
  days: 4,
  condition: "asthma_respiratory",
  medication: DEFAULT_MEDICATION_BY_CONDITION.asthma_respiratory,
  interests: "",
  budget: "balanced",
  hasSunLifeTravelCoverage: false,
};

function clampText(value: string, max: number): string {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

/** True when the trip step has the one field the next step needs. */
export function canContinueTripStep(config: TripConfig): boolean {
  return config.destination.trim().length > 0;
}

/** Trims labels and clamps the duration to the engine's supported range. */
export function normalizeTripConfig(config: TripConfig): TripConfig {
  return {
    destination: clampText(config.destination, DESTINATION_MAX),
    days: Math.max(TRIP_DAYS_MIN, Math.min(TRIP_DAYS_MAX, Math.round(config.days))),
    condition: config.condition,
    medication: clampText(config.medication, MEDICATION_MAX),
    interests: clampText(config.interests, INTERESTS_MAX),
    budget: config.budget,
    hasSunLifeTravelCoverage: config.hasSunLifeTravelCoverage,
  };
}
