/**
 * Sun Life travel-coverage rules and alert builder.
 *
 * Inputs: tripDays and hasCoverage. Outputs: SUN_LIFE_RULES,
 * SUN_LIFE_STABILITY_WINDOW_DAYS_PLACEHOLDER, and SunLifeAlert. Invariants: one rules
 * constant for Step 4 and the engine; the stability window is unconfirmed (null) and is
 * never presented as a number. Verify all rules with the plan administrator.
 */

import { HealthTripInputError, type SunLifeAlert } from "./healthTripTypes";

export type { SunLifeAlert, SunLifeSeverity } from "./healthTripTypes";

// VERIFY: The pre-existing-condition stability window was NOT supplied. Confirm the
// real window with the Sun Life plan administrator and update AGENTS.md section 9; do
// not present a placeholder number as policy.
/**
 * Placeholder for the pre-existing-condition stability window. The actual window was
 * not supplied; the value is null and must never be replaced with an invented number.
 */
export const SUN_LIFE_STABILITY_WINDOW_DAYS_PLACEHOLDER: number | null = null;

// VERIFY against current group policy: confirm the 60-day trip cap, the Allianz
// Global Assistance 24/7 pre-authorization requirement, and the stability window.
// VERIFY: Add the confirmed policy source and checked date to AGENTS.md section 9.
/**
 * Modeled Sun Life coverage rules shared by the engine alert and the Step 4 builder.
 * The stability window is unconfirmed and has no numeric value.
 */
export const SUN_LIFE_RULES = {
  tripDayCap: 60,
  preAuthorization: {
    provider: "Allianz Global Assistance",
    availability: "24/7",
    required: true,
    note: "Pre-authorization is required before non-emergency care.",
  },
  stabilityWindow: {
    days: SUN_LIFE_STABILITY_WINDOW_DAYS_PLACEHOLDER,
    isPlaceholder: true,
    note: "The pre-existing-condition stability window is not confirmed.",
  },
  administratorNotice: "Verify with your plan administrator",
} as const;

/**
 * Check trip length against the modeled Sun Life rules. Accepts any positive integer
 * tripDays so the 60-day cap is testable beyond the planner's 2-7 day range.
 */
export function checkSunLifeCoverage(
  tripDays: number,
  hasCoverage: boolean,
): SunLifeAlert {
  if (!Number.isInteger(tripDays) || tripDays < 1) {
    throw new HealthTripInputError(
      "invalid_days",
      "days",
      "Trip length must be a positive whole number of days.",
    );
  }

  const cap = SUN_LIFE_RULES.tripDayCap;
  const { provider, availability } = SUN_LIFE_RULES.preAuthorization;
  const stabilityMessage = SUN_LIFE_RULES.stabilityWindow.note;
  const administratorNotice = SUN_LIFE_RULES.administratorNotice;

  if (tripDays > cap) {
    return {
      severity: "blocking",
      title: `Trip length exceeds the modeled ${cap}-day Sun Life cap`,
      messages: [
        `This trip runs ${tripDays} days, beyond the modeled ${cap}-day trip cap.`,
        hasCoverage
          ? "Coverage may not extend beyond the cap."
          : "No Sun Life travel coverage is recorded for this trip.",
        "Confirm an extension or split the trip before booking.",
        stabilityMessage,
        administratorNotice,
      ],
    };
  }

  if (!hasCoverage) {
    return {
      severity: "caution",
      title: "Sun Life coverage is not confirmed",
      messages: [
        "No Sun Life travel coverage is recorded for this trip.",
        "Confirm coverage or arrange alternate medical travel insurance before booking.",
        `${provider} pre-authorization is required ${availability} before non-emergency care.`,
        stabilityMessage,
        administratorNotice,
      ],
    };
  }

  return {
    severity: "ok",
    title: "Within the modeled Sun Life trip cap",
    messages: [
      `This trip runs ${tripDays} days, within the modeled ${cap}-day trip cap.`,
      `${provider} pre-authorization is required ${availability} before non-emergency care.`,
      stabilityMessage,
      administratorNotice,
    ],
  };
}
