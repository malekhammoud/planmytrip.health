/**
 * Versioned data contract for the trip-outcome loop.
 *
 * Inputs: none. Outputs: the consented trip dossier, computed dose rows, feature rows,
 * outcome labels, and training rows shared by capture, storage, and the model.
 * Invariants: a dossier only exists with explicit consent; every dose row is computed
 * from plan blocks, never taken from an agent's self-report; every label is an explicit
 * yes or no, never inferred from silence.
 */

import type { BudgetLevel } from "../agent/agentTypes";
import type { Condition } from "../types";

/** Bump when any field below changes meaning or shape. */
export const DATA_SCHEMA_VERSION = 1 as const;

/** Bump when consent copy or scope changes. */
export const CONSENT_VERSION = 1 as const;

/** Bump when the deterministic engine's caps or scoring change. */
export const ENGINE_VERSION = "1" as const;

/** Which plan produced a dose row. */
export type DoseSource = "engine" | "concierge" | "fallback";

/**
 * One day's prescribed biological load, computed from block durations and exertion.
 * `stepCeiling` and `walkingCapKm` are the engine's day caps, not targets.
 */
export interface PlannedDose {
  day: number;
  steps: number;
  walkingKm: number;
  activeMinutes: number;
  exertionWeightedMinutes: number;
  recoveryMinutes: number;
  stepCeiling: number;
  walkingCapKm: number;
  withinCaps: boolean;
  /** True when the day carried no blocks at all; an empty day is never safe. */
  empty: boolean;
  source: DoseSource;
}

/** The model's v0 feature row; nullable fields are not used until v1. */
export interface TripFeatures {
  peakExposure: number;
  recoveryCoverage: number;
  tripLength: number;
  adherence: number | null;
  heatFlag: 0 | 1;
  altitudeFlag: 0 | 1;
  baselineBurden: number | null;
}

/** Request fields saved with the dossier. */
export interface TripRequestRecord {
  destination: string;
  days: number;
  condition: Condition;
  medication: string;
  interests: string;
  budget: BudgetLevel;
  hasSunLifeTravelCoverage: boolean;
}

/** Engine output summary; the full itinerary is not stored. */
export interface EngineSummary {
  healthSafetyScore: number;
  baselineScore: number;
  riskReductionPct: number;
  dailyStepCeiling: number;
  dose: PlannedDose[];
}

/** Concierge or fallback plan summary. */
export interface PlanSummary {
  source: Exclude<DoseSource, "engine">;
  days: PlannedDose[];
  degraded: boolean;
  mock: boolean;
}

/** One specialist result, bounded for storage. */
export interface AgentResultSummary {
  agentId: string;
  ok: boolean;
  summary: string;
}

/** One TinyFish worker result, bounded for storage. */
export interface WorkerFindingSummary {
  worker: string;
  ok: boolean;
  sourceUrl: string | null;
  retrievedAt: string | null;
  summary: string;
}

/** Both verification teams' results. Research is a byproduct, not the label. */
export interface VerificationSummary {
  research: AgentResultSummary[];
  swarm: WorkerFindingSummary[];
}

/** Explicit, versioned capture consent. */
export interface ConsentRecord {
  capture: true;
  version: typeof CONSENT_VERSION;
  at: string;
}

/**
 * One consented trip: the prescription, its computed dose, the agent summaries, and the
 * features the model learns from. Created only after the plan is ready.
 */
export interface TripDossier {
  schemaVersion: typeof DATA_SCHEMA_VERSION;
  runId: string;
  installId: string;
  createdAt: string;
  request: TripRequestRecord;
  engine: EngineSummary;
  plan: PlanSummary;
  verification: VerificationSummary;
  features: TripFeatures;
  consent: ConsentRecord;
}

/** Flare severity as reported by the traveler. Not a clinical grade. */
export type FlareSeverity = "mild" | "moderate" | "severe";

/** Care sought during or after the trip. */
export type CareLevel = "none" | "clinic" | "er" | "hospital";

/** Self-reported adherence to the planned pace. */
export type AdherenceLevel = "less" | "same" | "more";

/**
 * The post-trip label. `flare` is required: a missing answer is not a negative.
 * `flareDay` is 1-7 during the trip, or 0 for after return.
 */
export interface OutcomeRecord {
  flare: boolean;
  flareDay: number | null;
  severity: FlareSeverity | null;
  care: CareLevel | null;
  adherence: AdherenceLevel | null;
  /** Reserved for a future consented feature; the public route never stores free text. */
  notes: string | null;
  reportedAt: string;
}

/** One row for offline training; `offset` is the engine's prior log-odds. */
export interface TrainingRow {
  runId: string;
  userId: string;
  condition: Condition;
  features: TripFeatures;
  offset: number;
  label: 0 | 1;
  days: number;
  /**
   * Marker on the committed synthetic cohort. An artifact trained with `--source
   * outcomes` must reject any row carrying it, so a demo cohort can never be shipped as
   * observed evidence by accident.
   */
  synthetic?: true;
}

/** Browser-provided capture context; both ids are opaque and anonymous. */
export interface TripCaptureContext {
  runId: string;
  installId: string;
  consent: boolean;
}
