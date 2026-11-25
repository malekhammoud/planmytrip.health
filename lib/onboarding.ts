/**
 * Trip draft helpers for the onboarding flow.
 *
 * Inputs: a partially edited trip configuration.
 * Outputs: the default draft, a step gate, and a normalized configuration.
 * Invariants: the draft is a label-only planning input; it is never medical advice. The
 * destination is the only hard gate before the health step. Lengths match the API bounds.
 */

import { TRIP_DAYS_MAX, TRIP_DAYS_MIN } from "@/lib/healthTripTypes";
import type { TripConfig } from "@/lib/agent/agentTypes";
import { isIsoDate } from "@/lib/dates";

const DESTINATION_MAX = 120;
const ORIGIN_MAX = 120;
const INTERESTS_MAX = 240;

/** The empty draft shown to a first-time visitor. */
export const DEFAULT_TRIP: TripConfig = {
  destination: "",
  origin: "",
  days: 4,
  condition: "asthma_respiratory",
  interests: "",
  budget: "balanced",
  transport: "mixed",
  checkIn: "",
  travelers: 1,
  captureConsent: false,
};

function clampText(value: string, max: number): string {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

/** True when the trip step has the one field the next step needs. */
export function canContinueTripStep(config: TripConfig): boolean {
  return config.destination.trim().length > 0;
}

/**
 * Trims labels and clamps the duration to the engine's supported range and the account's
 * plan ceiling. The default preserves the engine maximum for callers without a plan.
 */
export function normalizeTripConfig(
  config: TripConfig,
  maxDays = TRIP_DAYS_MAX,
): TripConfig {
  // Saved rows written before the date and party fields existed still normalize safely.
  const checkIn = typeof config.checkIn === "string" ? config.checkIn.trim() : "";
  const travelers = Number.isFinite(config.travelers) ? Math.round(config.travelers) : 1;
  const dayCeiling = Math.max(
    TRIP_DAYS_MIN,
    Math.min(TRIP_DAYS_MAX, Math.round(maxDays)),
  );
  return {
    destination: clampText(config.destination, DESTINATION_MAX),
    origin: clampText(config.origin, ORIGIN_MAX),
    days: Math.max(TRIP_DAYS_MIN, Math.min(dayCeiling, Math.round(config.days))),
    condition: config.condition,
    interests: clampText(config.interests, INTERESTS_MAX),
    budget: config.budget,
    transport: config.transport,
    checkIn: isIsoDate(checkIn) ? checkIn : "",
    travelers: Math.max(1, Math.min(8, travelers)),
    captureConsent: config.captureConsent,
  };
}
