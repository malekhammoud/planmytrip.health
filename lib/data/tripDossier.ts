/**
 * Builds the consented trip dossier and validates post-trip outcomes.
 *
 * Inputs: a validated request, the engine plan, the concierge plan, bounded agent
 * summaries, and a timestamp. Outputs: a versioned TripDossier or a normalized outcome.
 * Invariants: the dose is computed from plan blocks; a plan with no days falls back to
 * the engine dose; an outcome requires an explicit boolean; labels never carry doses.
 */

import { CONDITION_PROFILES } from "../conditionProfiles";
import type { AgentTripPlan } from "../agent/agentTypes";
import type { HealthTripPlan } from "../healthTripTypes";
import { computeEngineDose, computePlannerDose, computeTripFeatures } from "./dose";
import {
  CONSENT_VERSION,
  DATA_SCHEMA_VERSION,
  type AdherenceLevel,
  type AgentResultSummary,
  type CareLevel,
  type FlareSeverity,
  type OutcomeRecord,
  type TripDossier,
  type TripRequestRecord,
  type WorkerFindingSummary,
} from "./types";

/** Everything the planner route has when plan_ready fires. */
export interface BuildDossierInput {
  runId: string;
  installId: string;
  createdAt: string;
  request: TripRequestRecord;
  enginePlan: HealthTripPlan;
  agentPlan: AgentTripPlan;
  research: readonly AgentResultSummary[];
  swarm: readonly WorkerFindingSummary[];
}

/**
 * Assembles one dossier. The concierge dose is authoritative; the engine dose is kept
 * as the comparable baseline and as the fallback when synthesis produced no days.
 */
export function buildTripDossier(input: BuildDossierInput): TripDossier {
  const profile = CONDITION_PROFILES[input.request.condition];
  const engineDose = computeEngineDose(input.enginePlan.itinerary);
  const plannerDose = computePlannerDose(
    input.agentPlan.days,
    input.agentPlan.places,
    input.agentPlan.degraded === true ? "fallback" : "concierge",
  );
  const planDose = plannerDose.length > 0 ? plannerDose : engineDose;
  const features = computeTripFeatures({
    dose: planDose,
    profile,
    days: input.request.days,
    places: input.agentPlan.places,
  });
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    runId: input.runId,
    installId: input.installId,
    createdAt: input.createdAt,
    request: input.request,
    engine: {
      healthSafetyScore: input.enginePlan.healthSafetyScore,
      baselineScore: input.enginePlan.baselineScore,
      riskReductionPct: input.enginePlan.riskReductionPct,
      dailyStepCeiling: input.enginePlan.dailyStepCeiling,
      dose: engineDose,
    },
    plan: {
      source: input.agentPlan.degraded === true ? "fallback" : "concierge",
      days: plannerDose,
      degraded: input.agentPlan.degraded === true,
      mock: input.agentPlan.mock === true,
    },
    verification: {
      research: [...input.research],
      swarm: [...input.swarm],
    },
    features,
    consent: {
      capture: true,
      version: CONSENT_VERSION,
      at: input.createdAt,
    },
  };
}

const SEVERITIES: readonly FlareSeverity[] = ["mild", "moderate", "severe"];
const CARE_LEVELS: readonly CareLevel[] = ["none", "clinic", "er", "hospital"];
const ADHERENCE_LEVELS: readonly AdherenceLevel[] = ["less", "same", "more"];

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

function boundedNotes(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().slice(0, 500);
  return text.length > 0 ? text : null;
}

/**
 * Normalizes an outcome body. `flare` is required and must be a boolean: silence is not
 * a negative. A false flare clears the flare-only fields.
 */
export function parseOutcome(
  value: unknown,
  reportedAt: string,
): OutcomeRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const body = value as Record<string, unknown>;
  if (typeof body.flare !== "boolean") return null;
  const flare = body.flare;
  const rawDay = body.flareDay;
  const flareDay =
    typeof rawDay === "number" &&
    Number.isInteger(rawDay) &&
    rawDay >= 0 &&
    rawDay <= 7
      ? rawDay
      : null;
  const severity = oneOf(body.severity, SEVERITIES);
  const care = oneOf(body.care, CARE_LEVELS);
  const adherence = oneOf(body.adherence, ADHERENCE_LEVELS);
  return {
    flare,
    flareDay: flare ? flareDay : null,
    severity: flare ? severity : null,
    care: flare ? care : null,
    adherence,
    notes: boundedNotes(body.notes),
    reportedAt,
  };
}
