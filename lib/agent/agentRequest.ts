/**
 * Validation for POST /api/agent-plan bodies.
 *
 * Inputs: untrusted JSON. Outputs: a narrowed PlannerRequest or null.
 * Invariants: destination, origin, medication, and interests are trimmed; lengths are
 * bounded; days stay inside the engine's supported range; an absent transport becomes mixed
 * so older clients keep working; unknown keys are ignored.
 */

import { TRIP_DAYS_MAX, TRIP_DAYS_MIN } from "@/lib/healthTripTypes";
import { isIsoDate } from "@/lib/dates";
import { parseInstallId, parseRunId } from "@/lib/data/validation";
import { isCondition, isTransportMode } from "@/lib/types";
import { BUDGET_LEVELS, type BudgetLevel, type PlannerRequest } from "./agentTypes";

const DESTINATION_MAX = 120;
const ORIGIN_MAX = 120;
const MEDICATION_MAX = 120;
const INTERESTS_MAX = 240;

/** True only for one of the three budget levels. */
export function isBudgetLevel(value: unknown): value is BudgetLevel {
  return (
    typeof value === "string" &&
    (BUDGET_LEVELS as readonly string[]).includes(value)
  );
}

function boundedText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  return text.length <= max ? text : null;
}

/**
 * Narrows a request body. The optional budget defaults to balanced and the optional
 * transport defaults to mixed; every other field is required. Returns null for any wrong
 * type or out-of-range value.
 */
export function parsePlannerRequest(value: unknown): PlannerRequest | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const body = value as Record<string, unknown>;
  const destination = boundedText(body.destination, DESTINATION_MAX);
  if (destination === null || destination.length === 0) return null;
  const origin = boundedText(body.origin ?? "", ORIGIN_MAX);
  if (origin === null) return null;
  if (
    typeof body.days !== "number" ||
    !Number.isInteger(body.days) ||
    body.days < TRIP_DAYS_MIN ||
    body.days > TRIP_DAYS_MAX
  ) {
    return null;
  }
  if (!isCondition(body.condition)) return null;
  const medication = boundedText(body.medication, MEDICATION_MAX);
  if (medication === null) return null;
  const interests = boundedText(body.interests ?? "", INTERESTS_MAX);
  if (interests === null) return null;
  const budget = body.budget === undefined ? "balanced" : body.budget;
  if (!isBudgetLevel(budget)) return null;
  const transport = body.transport === undefined ? "mixed" : body.transport;
  if (!isTransportMode(transport)) return null;
  const checkInRaw = body.checkIn === undefined ? "" : body.checkIn;
  if (typeof checkInRaw !== "string") return null;
  const checkIn = checkInRaw.trim();
  if (checkIn.length > 0 && !isIsoDate(checkIn)) return null;
  const travelers = body.travelers === undefined ? 1 : body.travelers;
  if (
    typeof travelers !== "number" ||
    !Number.isInteger(travelers) ||
    travelers < 1 ||
    travelers > 8
  ) {
    return null;
  }
  if (body.captureConsent !== undefined && typeof body.captureConsent !== "boolean") {
    return null;
  }
  if (
    body.hasSunLifeTravelCoverage !== undefined &&
    typeof body.hasSunLifeTravelCoverage !== "boolean"
  ) {
    return null;
  }
  const runId = body.runId === undefined ? undefined : parseRunId(body.runId);
  if (runId === null) return null;
  const installId =
    body.installId === undefined ? undefined : parseInstallId(body.installId);
  if (installId === null) return null;
  return {
    destination,
    origin,
    days: body.days,
    condition: body.condition,
    medication,
    interests,
    budget,
    transport,
    checkIn,
    travelers,
    ...(runId === undefined ? {} : { runId }),
    ...(installId === undefined ? {} : { installId }),
    captureConsent: body.captureConsent === true,
    hasSunLifeTravelCoverage: body.hasSunLifeTravelCoverage === true,
  };
}
