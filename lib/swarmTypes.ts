/**
 * Shared wire contracts for the travel swarm: worker identifiers, the validated
 * request body, typed findings, and the SSE events this app emits.
 *
 * Inputs: untrusted route bodies (isSwarmRequestBody) and normalised worker results.
 * Outputs: typed payloads plus encodeSwarmEvent, a pure frame formatter.
 * Invariants: every payload carries `worker` and an ISO `ts`; missing text is null and
 * missing lists are empty, never invented. This module has no Node imports so the
 * Step 6 browser hook can share the event types.
 */

import { isCondition, type Condition } from "@/lib/types";
import { parseInstallId, parseRunId } from "@/lib/data/validation";

/** The three research workers, in stable display order. */
export const WORKER_IDS = ["advisory", "pharmacy", "coverage"] as const;

/** Destination and medication are prompt inputs and stored summaries, so both are bounded. */
const SWARM_TEXT_MAX = 120;

/** Collapses whitespace so a newline cannot turn one prompt field into instructions. */
export function normalizeSwarmText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function boundedText(value: unknown, allowEmpty = false): string | null {
  if (typeof value !== "string") return null;
  const text = normalizeSwarmText(value);
  if (!allowEmpty && text.length === 0) return null;
  if (text.length > SWARM_TEXT_MAX) return null;
  return text;
}

/** One of the three research workers. */
export type WorkerId = (typeof WORKER_IDS)[number];

/** Narrows an untrusted value to a WorkerId. */
export function isWorkerId(value: unknown): value is WorkerId {
  return typeof value === "string" && (WORKER_IDS as readonly string[]).includes(value);
}

/** Hand-validated body accepted by POST /api/travel-swarm. */
export interface SwarmRequestBody {
  destination: string;
  condition: Condition;
  medication: string;
  workers?: WorkerId[];
  /** Opaque browser run id shared with the planner capture. */
  runId?: string;
  /** Anonymous install id. */
  installId?: string;
  /** Explicit opt-in for saving verification findings. */
  captureConsent?: boolean;
}

/**
 * Validates a request body without a schema library.
 * Accepts an optional non-empty worker subset; rejects empty or unknown worker lists.
 */
export function isSwarmRequestBody(value: unknown): value is SwarmRequestBody {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  if (boundedText(body.destination) === null) return false;
  if (!isCondition(body.condition)) return false;
  if (boundedText(body.medication, true) === null) return false;
  if (body.runId !== undefined && parseRunId(body.runId) === null) return false;
  if (body.installId !== undefined && parseInstallId(body.installId) === null) {
    return false;
  }
  if (body.captureConsent !== undefined && typeof body.captureConsent !== "boolean") {
    return false;
  }
  if (body.workers === undefined) return true;
  return (
    Array.isArray(body.workers) &&
    body.workers.length > 0 &&
    body.workers.every(isWorkerId)
  );
}

/**
 * Resolves the requested workers to a de-duplicated canonical order.
 * Callers must pass a validated body; undefined means all three.
 */
export function resolveWorkers(workers: readonly WorkerId[] | undefined): WorkerId[] {
  if (workers === undefined) return [...WORKER_IDS];
  return WORKER_IDS.filter((worker) => workers.includes(worker));
}

/** Findings from the Government of Canada advisory worker. */
export interface AdvisoryFindings {
  destinationRiskLevel: string | null;
  riskSummary: string | null;
  healthNotices: string[];
  environmentalHazards: string[];
}

/** Findings from the international pharmacy worker. */
export interface PharmacyFindings {
  genericName: string | null;
  localBrandNames: string[];
  customsRules: string | null;
  carryRules: string | null;
}

/** Provenance tag attached to every coverage checklist item. */
export type CoverageSource = "page" | "inferred";

/** One pre-departure checklist item and whether the page stated it. */
export interface CoverageChecklistItem {
  item: string;
  source: CoverageSource;
}

/** Findings from the emergency travel medical coverage worker. */
export interface CoverageFindings {
  emergencyMedicalLimit: string | null;
  preAuthorizationRules: string | null;
  checklist: CoverageChecklistItem[];
}

/** Findings for any worker, discriminated by the event's worker id. */
export type SwarmFindings =
  | AdvisoryFindings
  | PharmacyFindings
  | CoverageFindings;

/** Normalised advisory result including the page it came from. */
export interface AdvisoryResult extends AdvisoryFindings {
  sourceUrl: string;
}

/** Normalised pharmacy result including the page it came from. */
export interface PharmacyResult extends PharmacyFindings {
  sourceUrl: string;
}

/** Normalised coverage result including the page it came from. */
export interface CoverageResult extends CoverageFindings {
  sourceUrl: string;
}

/** Any normalised worker result. */
export type WorkerResult = AdvisoryResult | PharmacyResult | CoverageResult;

/** Findings plus resolved source URL, as stored by the route. */
export interface NormalizedWorkerResult {
  findings: SwarmFindings;
  sourceUrl: string;
}

/** Final success flag for one worker, used to build swarm_done. */
export interface WorkerOutcome {
  worker: WorkerId;
  ok: boolean;
}

/** Error codes the UI can branch on. */
export type SwarmErrorCode = "missing_api_key" | "timeout" | "upstream_error";

/** Payload for worker_status: the worker entered the queue or started running. */
export interface WorkerStatusPayload {
  worker: WorkerId;
  ts: string;
  status: "queued" | "running";
  mock?: true;
}

/** Payload for streaming_url: the live preview iframe URL for one worker. */
export interface StreamingUrlPayload {
  worker: WorkerId;
  ts: string;
  streamingUrl: string;
  mock?: true;
}

/** Payload for worker_progress: a human-readable purpose update. */
export interface WorkerProgressPayload {
  worker: WorkerId;
  ts: string;
  purpose: string;
  mock?: true;
}

/** Payload for worker_complete: typed findings plus provenance. */
export interface WorkerCompletePayload {
  worker: WorkerId;
  ts: string;
  findings: SwarmFindings;
  sourceUrl: string;
  retrievedAt: string;
  rawResult?: string;
  parseError?: string;
  mock?: true;
}

/** Payload for worker_error: a calm, user-facing failure. */
export interface WorkerErrorPayload {
  worker: WorkerId;
  ts: string;
  code: SwarmErrorCode;
  message: string;
  mock?: true;
}

/** Payload for swarm_done: the final frame of every stream. */
export interface SwarmDonePayload {
  worker: "swarm";
  ts: string;
  completed: WorkerId[];
  failed: WorkerId[];
  mock?: true;
}

/** Names of the SSE events this route emits. */
export type SwarmEventName =
  | "worker_status"
  | "streaming_url"
  | "worker_progress"
  | "worker_complete"
  | "worker_error"
  | "swarm_done";

/** A complete server-sent event, pairing the event name with its payload. */
export type SwarmEvent =
  | { event: "worker_status"; data: WorkerStatusPayload }
  | { event: "streaming_url"; data: StreamingUrlPayload }
  | { event: "worker_progress"; data: WorkerProgressPayload }
  | { event: "worker_complete"; data: WorkerCompletePayload }
  | { event: "worker_error"; data: WorkerErrorPayload }
  | { event: "swarm_done"; data: SwarmDonePayload };

/** Encodes one event as an SSE frame. JSON never contains a raw newline, so one data line is safe. */
export function encodeSwarmEvent(event: SwarmEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
}
