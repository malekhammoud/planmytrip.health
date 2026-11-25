/**
 * Trip draft helpers for the onboarding flow.
 *
 * Inputs: a partially edited trip draft.
 * Outputs: the empty draft, step gates, a normalized configuration, and the plan
 * allowance sentence.
 * Invariants: the draft is a label-only planning input; it is never medical advice. The
 * destination gates the second step. The health profile defaults to general relaxation and
 * can be changed; an invalid or empty value still gates the build. Lengths match the API
 * bounds.
 */

import { TRIP_DAYS_MAX, TRIP_DAYS_MIN } from "@/lib/healthTripTypes";
import type { TripConfig } from "@/lib/agent/agentTypes";
import type { BillingEntitlements } from "@/lib/billing/plans";
import { planLabel } from "@/lib/billing/plans";
import { isIsoDate } from "@/lib/dates";
import { isCondition, type Condition } from "@/lib/types";

const DESTINATION_MAX = 120;
const ORIGIN_MAX = 120;
const INTERESTS_MAX = 240;

/** The trip fields before the traveler has picked a health profile. */
export type TripDraft = Omit<TripConfig, "condition"> & {
  /** Empty until the traveler picks a profile; the form never defaults one. */
  condition: Condition | "";
};

/** The empty draft shown to a first-time visitor, with the general relaxation profile. */
export const DEFAULT_TRIP: TripDraft = {
  destination: "",
  origin: "",
  days: 4,
  condition: "general_wellness",
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
export function canContinueTripStep(
  config: Pick<TripDraft, "destination">,
): boolean {
  return config.destination.trim().length > 0;
}

/** True when the draft has both a destination and an explicit health profile. */
export function canBuildTrip(config: TripDraft): boolean {
  return canContinueTripStep(config) && isCondition(config.condition);
}

/**
 * Trims labels and clamps the duration to the engine's supported range and the account's
 * plan ceiling. Returns null until the destination and a valid health profile are both
 * present; the normal first-time draft already carries the general relaxation profile.
 */
export function normalizeTripConfig(
  config: TripDraft,
  maxDays = TRIP_DAYS_MAX,
): TripConfig | null {
  if (!isCondition(config.condition) || !canContinueTripStep(config)) return null;
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

/** The limits needed to describe an account's live-plan allowance. */
export type PlanAllowance = Pick<
  BillingEntitlements,
  "plan" | "tripsPerPeriod" | "tripPeriod" | "maxTripDays"
>;

/**
 * One plain sentence naming the current plan's allowance. It states the plan's limits,
 * never a remaining count, because usage is enforced and counted in the server routes.
 */
export function describePlanAllowance(limits: PlanAllowance): string {
  const plans =
    limits.tripsPerPeriod === 1
      ? "1 live plan"
      : `${limits.tripsPerPeriod} live plans`;
  const period = limits.tripPeriod === "year" ? "a year" : "a month";
  return `${planLabel(limits.plan)} includes ${plans} ${period} and trips up to ${limits.maxTripDays} days.`;
}
