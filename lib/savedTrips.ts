/**
 * Contract for account-owned saved trips.
 *
 * Inputs: untrusted save bodies and rows from PostgreSQL. Outputs: validated trip and
 * plan snapshots for the saved-trip pages and API.
 * Invariants: a saved plan is rebuilt through the same wire normaliser as live plans;
 * mock plans are never saved; an account owns its rows by Clerk user id.
 */

import type {
  AgentTripPlan,
  TripConfig,
} from "./agent/agentTypes";
import { normalizeWirePlan } from "./agent/agentPlanParse";
import { parsePlannerRequest } from "./agent/agentRequest";
import { parseRunId } from "./data/validation";
import type { Condition } from "./types";

/** One validated save request. */
export interface SaveTripInput {
  runId: string;
  trip: TripConfig;
  plan: AgentTripPlan;
  savedAt: string;
}

/** A compact row for the saved-trip list. */
export interface SavedTripSummary {
  id: string;
  destination: string;
  days: number;
  condition: Condition;
  savedAt: string;
}

/** A complete saved trip, including the plan snapshot. */
export interface SavedTrip extends SavedTripSummary {
  runId: string;
  trip: TripConfig;
  plan: AgentTripPlan;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates one save body. The trip is normalized through the planner request parser,
 * and the plan is rebuilt through the same bounded normaliser as a live SSE frame.
 */
export function parseSaveTripBody(
  value: unknown,
  savedAt: string,
): SaveTripInput | null {
  if (!isRecord(value)) return null;
  const runId = parseRunId(value.runId);
  if (runId === null) return null;
  const request = parsePlannerRequest(value.trip);
  if (request === null) return null;
  const plan = normalizeWirePlan(value.plan);
  if (plan === null || plan.mock === true) return null;
  const trip: TripConfig = {
    destination: request.destination,
    origin: request.origin,
    days: request.days,
    condition: request.condition,
    medication: request.medication,
    interests: request.interests,
    budget: request.budget,
    transport: request.transport,
    checkIn: request.checkIn,
    travelers: request.travelers,
    hasSunLifeTravelCoverage: request.hasSunLifeTravelCoverage === true,
    // A saved snapshot never reruns capture. Consent belongs to the live run.
    captureConsent: false,
  };
  return { runId, trip, plan, savedAt };
}

/** Validates a saved-trip id before a database lookup. */
export function parseSavedTripId(value: unknown): string | null {
  return parseRunId(value);
}
