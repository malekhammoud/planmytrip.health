/**
 * Deterministic plain-text care card for the itinerary export.
 *
 * Inputs: a destination label, condition, and a built HealthTripPlan. Output: one
 * plain-text string. Invariants: pure and deterministic; no locale, Date, or randomness;
 * includes destination, condition, the daily step ceiling, and each day's step cap and
 * checkpoint. It never adds doses or clinical instructions and has no trailing newline.
 */

import type { HealthTripPlan } from "./healthTripEngine";
import { CONDITION_LABELS, type Condition } from "./types";
import type { VerificationAdjustment } from "./verificationOverlay";

const FALLBACK_DESTINATION = "Not set";
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

function formatRetrieved(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "time not recorded";
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function cleanReason(reason: string): string {
  return reason.trim().replace(/[.!?]+$/, "");
}

function adjustmentLine(adjustment: VerificationAdjustment): string {
  const source =
    adjustment.sourceUrl === ""
      ? "source not recorded"
      : `${adjustment.sourceUrl} (retrieved ${formatRetrieved(adjustment.retrievedAt)})`;
  const reason = cleanReason(adjustment.reason);
  if (adjustment.kind === "recovery") {
    return `- Day ${(adjustment.dayIndex ?? 0) + 1} afternoon recovery: ${adjustment.fromValue ?? 0} to ${adjustment.toValue ?? 0} min. Reason: ${reason}. Source: ${source}`;
  }
  return `- Day checkpoints: ${adjustment.title} — ${reason}. Source: ${source}`;
}

/**
 * Build the care card plain text. The exact section order is part of the contract:
 * title, trip facts, a blank line, the daily checkpoints, a blank line, optional applied
 * adjustments, and the planning notice. Section lines carry only the engine's
 * checkpoints and confirmed destination-check notes.
 */
export function buildCareCard(
  destination: string,
  condition: Condition,
  plan: HealthTripPlan,
  adjustments: readonly VerificationAdjustment[] = [],
): string {
  const destinationLabel = normalizeLabel(destination) || FALLBACK_DESTINATION;
  const dayCount = plan.itinerary.length;
  const lines: string[] = [
    "PlanMyTrip.health care card",
    `Destination: ${destinationLabel}`,
    `Condition: ${CONDITION_LABELS[condition]}`,
    `Trip length: ${dayCount} ${dayCount === 1 ? "day" : "days"}`,
    `Daily step ceiling: ${formatCount(plan.dailyStepCeiling)} steps`,
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

  const applied = adjustments.filter((adjustment) => adjustment.applied);
  if (applied.length > 0) {
    lines.push("", "Applied destination-check adjustments");
    for (const adjustment of applied) lines.push(adjustmentLine(adjustment));
  }

  lines.push("", PLANNING_NOTICE);
  return lines.join("\n");
}
