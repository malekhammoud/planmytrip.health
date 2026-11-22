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
export type SwarmErrorCode =
  | "missing_api_key"
  | "timeout"
  | "site_blocked"
  | "max_steps_exceeded"
  | "rate_limit"
  | "insufficient_credits"
  | "invalid_input"
  | "forbidden"
  | "cancelled"
  | "upstream_error";

/** Which TinyFish search or fetch produced a source row. */
export type TinyfishApi = "search" | "fetch";

/** One source consulted by an agent, rebuilt defensively from an upstream payload. */
export interface SwarmSourceItem {
  /** Absolute http(s) URL when the upstream item carried one. */
  url?: string;
  /** Page or result title when the upstream item carried one. */
  title?: string;
  /** Which TinyFish API produced it. */
  api: TinyfishApi;
}

/** Shared envelope for every worker-scoped frame. */
export interface SwarmWorkerEnvelope {
  worker: WorkerId;
  /** Monotonic per worker within one request, starting at 1. */
  seq: number;
  /** Server receive time, ISO. */
  ts: string;
  mock?: true;
  /** True when this frame replays a verified cached run. */
  cached?: true;
}

/** Payload for worker_status: the worker entered the queue. */
export interface WorkerStatusPayload extends SwarmWorkerEnvelope {
  status: "queued" | "running";
}

/** Payload for worker_started: TinyFish accepted the run. */
export interface WorkerStartedPayload extends SwarmWorkerEnvelope {
  runId: string | null;
  startedAt: string;
}

/** Payload for streaming_url: the live preview iframe URL for one worker. */
export interface StreamingUrlPayload extends SwarmWorkerEnvelope {
  streamingUrl: string;
}

/** Payload for worker_progress: a human-readable purpose update. */
export interface WorkerProgressPayload extends SwarmWorkerEnvelope {
  purpose: string;
  tinyfishApi?: TinyfishApi;
}

/** Payload for worker_sources: sources consulted so far, never findings. */
export interface WorkerSourcesPayload extends SwarmWorkerEnvelope {
  items: SwarmSourceItem[];
}

/** Payload for worker_heartbeat: the upstream stream is still open. */
export type WorkerHeartbeatPayload = SwarmWorkerEnvelope;

/** Payload for worker_note: bounded lifecycle copy, such as a retry reason. */
export interface WorkerNotePayload extends SwarmWorkerEnvelope {
  message: string;
}

/** Payload for worker_complete: typed findings plus provenance. */
export interface WorkerCompletePayload extends SwarmWorkerEnvelope {
  findings: SwarmFindings;
  sourceUrl: string;
  retrievedAt: string;
  rawResult?: string;
  parseError?: string;
  /** When the live result was produced and cached. */
  cachedAt?: string;
  /** Authenticated same-origin recording path, when one was archived. */
  recordingUrl?: string;
}

/** Payload for worker_error: a calm, user-facing failure. */
export interface WorkerErrorPayload extends SwarmWorkerEnvelope {
  code: SwarmErrorCode;
  message: string;
}

/** Aggregated counters carried by swarm_done. */
export interface SwarmDoneSummary {
  /** Progress steps emitted across the run. */
  steps: number;
  /** Deduplicated source rows emitted across the run. */
  sources: number;
  /** Workers that produced typed findings. */
  findings: number;
  /** Upstream event types this build did not recognise. */
  unknownEvents: number;
}

/** Payload for swarm_done: the final frame of every stream. */
export interface SwarmDonePayload {
  worker: "swarm";
  /** Monotonic per request, starting at 1. */
  seq: number;
  ts: string;
  completed: WorkerId[];
  failed: WorkerId[];
  summary: SwarmDoneSummary;
  mock?: true;
  /** True when this run replayed the verified cache. */
  cached?: true;
  /** When the live run was produced and cached. */
  cachedAt?: string;
}

/** Names of the SSE events this route emits. */
export type SwarmEventName =
  | "worker_status"
  | "worker_started"
  | "streaming_url"
  | "worker_progress"
  | "worker_sources"
  | "worker_heartbeat"
  | "worker_note"
  | "worker_complete"
  | "worker_error"
  | "swarm_done";

/** A complete server-sent event, pairing the event name with its payload. */
export type SwarmEvent =
  | { event: "worker_status"; data: WorkerStatusPayload }
  | { event: "worker_started"; data: WorkerStartedPayload }
  | { event: "streaming_url"; data: StreamingUrlPayload }
  | { event: "worker_progress"; data: WorkerProgressPayload }
  | { event: "worker_sources"; data: WorkerSourcesPayload }
  | { event: "worker_heartbeat"; data: WorkerHeartbeatPayload }
  | { event: "worker_note"; data: WorkerNotePayload }
  | { event: "worker_complete"; data: WorkerCompletePayload }
  | { event: "worker_error"; data: WorkerErrorPayload }
  | { event: "swarm_done"; data: SwarmDonePayload };

/** Encodes one event as an SSE frame. JSON never contains a raw newline, so one data line is safe. */
export function encodeSwarmEvent(event: SwarmEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
}
