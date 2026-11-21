/**
 * Deterministic plain-text care card for the itinerary export.
 *
 * Inputs: a destination label, condition, medication name only, and a built
 * HealthTripPlan. Output: one plain-text string. Invariants: pure and deterministic;
 * no locale, Date, or randomness; includes destination, condition, medication, the
 * daily step ceiling, the Sun Life alert, and each day's step cap and checkpoint.
 * It never adds doses or medication changes and has no trailing newline.
 */

import type { HealthTripPlan } from "./healthTripEngine";
import { CONDITION_LABELS, type Condition } from "./types";

const FALLBACK_DESTINATION = "Not set";
const NO_MEDICATION = "None recorded";
const PLANNING_NOTICE =
  "Planning aid only. Not medical advice. Confirm with your clinician and insurer before you travel.";

function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function formatCount(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Build the care card plain text. The exact section order is part of the contract:
 * title, trip facts, a blank line, the Sun Life block, a blank line, the daily
 * checkpoints, a blank line, and the planning notice. Section lines never carry
 * medical advice beyond the engine's checkpoints; medication is a name only.
 */
export function buildCareCard(
  destination: string,
  condition: Condition,
  medication: string,
  plan: HealthTripPlan,
): string {
  const destinationLabel = normalizeLabel(destination) || FALLBACK_DESTINATION;
  const medicationLabel = normalizeLabel(medication) || NO_MEDICATION;
  const dayCount = plan.itinerary.length;
  const lines: string[] = [
    "PlanMyTrip.health care card",
    `Destination: ${destinationLabel}`,
    `Condition: ${CONDITION_LABELS[condition]}`,
    `Medication: ${medicationLabel}`,
    `Trip length: ${dayCount} ${dayCount === 1 ? "day" : "days"}`,
    `Daily step ceiling: ${formatCount(plan.dailyStepCeiling)} steps`,
    "",
    "Sun Life",
    plan.sunLifeAlert.title,
    ...plan.sunLifeAlert.messages.map((message) => `- ${message}`),
    "",
    "Daily checkpoints",
  ];

  if (dayCount === 0) {
    lines.push("No itinerary days are available.");
  } else {
    for (const day of plan.itinerary) {
      lines.push(
        `Day ${day.day} (step cap ${formatCount(day.stepCap)} steps): ${day.healthCheckpoint}`,
      );
    }
  }

  lines.push("", PLANNING_NOTICE);
  return lines.join("\n");
}
