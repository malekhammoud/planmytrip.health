/**
 * Runs TinyFish browser jobs for live menu and hotel evidence.
 *
 * Inputs: a validated venue-research request, the server-side key, and an SSE emitter.
 * Outputs: venue_started/status/activity/streaming_url/sources/result/error frames and a
 * final venue_done, plus the collected evidence rows.
 * Invariants: jobs open only supplied URLs; no recording is requested; a dropped stream is
 * recovered from GET /v1/runs/{id}; a failed job retries once; cached evidence wins; the
 * checked page is always in the source ledger; no raw provider body is logged or returned.
 */

import type { TinyfishEvent } from "@/lib/tinyfish";
import { streamTinyfishRun } from "@/lib/tinyfish";
import { fetchTinyfishRun } from "@/lib/tinyfishRuns";
import { extractSources, mapTinyfishErrorCode } from "@/lib/tinyfishEvents";
import { asNumber, asText, isRecord } from "@/lib/agent/agentParse";
import { addDaysIso } from "@/lib/dates";
import {
  readCachedVenue,
  venueCacheKey,
  writeCachedVenue,
  type VenueCacheActivity,
  type VenueCacheRecord,
} from "@/lib/cache/venueCache";
import { buildHotelGoal, buildMenuGoal, HOTEL_SCHEMA, MENU_SCHEMA } from "./goals";
import type {
  HotelEvidence,
  MenuEvidence,
  VenueCandidate,
  VenueEvent,
  VenueEvidence,
  VenueResearchRequest,
  VenueSourceItem,
  VenueWorkerMeta,
} from "./types";
import type { VenueActivityKind } from "./venueState";
import { candidateUrl } from "./types";
import { asPublicHttpUrl } from "./url";

// VERIFY: the 75s job timeout, 45s run-record recovery, 255s run budget, three concurrent
// browsers, and maxDurationSeconds: 90 against current TinyFish limits and billing.
const JOB_TIMEOUT_MS = 75_000;
const RECOVERY_LIMIT_MS = 45_000;
const TRANSITION_POLL_MS = 2_000;
const MAX_PARALLEL = 3;
const ACTIVITY_LIMIT = 30;
/** Leaves room inside the 300s route for the terminal frame and cache writes. */
const RUN_BUDGET_MS = 255_000;
const MIN_ATTEMPT_MS = 15_000;

type JobKind = "menu" | "hotel";
type Emit = (event: VenueEvent) => void;

interface VenueJob {
  worker: VenueWorkerMeta;
  kind: JobKind;
  candidate: VenueCandidate;
  url: string;
  fallbackUrl: string | null;
  goal: string;
  schema: Record<string, unknown>;
  checkIn: string;
  checkOut: string;
  travelers: number;
  cacheKey: string;
}

interface ProviderOutcome {
  result: unknown | null;
  errorCode: string | null;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseResult(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function runErrorText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!isRecord(value)) return null;
  return asText(value.code, 80) ?? asText(value.message, 200);
}

function checkedLabel(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "an earlier check";
  return date.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Polls the authoritative run record after a stream ends or fails. */
async function recoverResult(
  runId: string,
  apiKey: string,
  signal: AbortSignal,
  limitMs: number,
): Promise<unknown | null> {
  const deadline = Date.now() + Math.min(RECOVERY_LIMIT_MS, limitMs);
  while (Date.now() < deadline) {
    if (signal.aborted) return null;
    const detail = await fetchTinyfishRun(runId, apiKey);
    if (detail !== null) {
      const status = typeof detail.status === "string" ? detail.status.toUpperCase() : "";
      if (status === "COMPLETED") return parseResult(detail.result);
      if (status === "FAILED" || status === "CANCELLED") {
        console.warn("[venue] run failed", status, runErrorText(detail.error) ?? "");
        return null;
      }
    }
    await wait(TRANSITION_POLL_MS);
  }
  return null;
}

/**
 * Runs one JSON extraction, forwarding provider telemetry and recovering a dropped stream
 * from the authoritative run record.
 */
async function runProvider(
  job: VenueJob,
  url: string,
  apiKey: string,
  signal: AbortSignal,
  onEvent: (event: TinyfishEvent) => void,
  timeoutMs: number,
): Promise<ProviderOutcome> {
  const timeout = AbortSignal.timeout(Math.min(JOB_TIMEOUT_MS, timeoutMs));
  const combined = AbortSignal.any([signal, timeout]);
  let runId: string | null = null;
  let result: unknown = null;
  let completed = false;
  let errorCode: string | null = null;

  try {
    await streamTinyfishRun({
      apiKey,
      url,
      goal: job.goal,
      outputSchema: job.schema,
      agentConfig: {
        cursorStyle: "standard",
        maxDurationSeconds: 90,
      },
      captureRecording: false,
      signal: combined,
      onEvent: (event) => {
        if (event.type === "STARTED" && event.runId !== null) runId = event.runId;
        if (event.type === "COMPLETE") {
          if (event.status === "COMPLETED") {
            result = parseResult(event.result);
            completed = true;
          } else {
            errorCode = mapTinyfishErrorCode(event.error ?? event.status);
          }
        }
        onEvent(event);
      },
    });
  } catch {
    // The run record is the source of truth after a stream or network failure.
  }

  if (completed && result !== null) return { result, errorCode: null };
  if (runId !== null) {
    const recovered = await recoverResult(runId, apiKey, signal, timeoutMs);
    if (recovered !== null) return { result: recovered, errorCode: null };
  }
  return { result: null, errorCode: errorCode ?? "upstream_error" };
}

function errorCode(
  value: string | null,
): "timeout" | "blocked" | "invalid_input" | "upstream_error" {
  if (value === "timeout") return "timeout";
  if (value === "site_blocked") return "blocked";
  if (value === "invalid_input") return "invalid_input";
  return "upstream_error";
}

function menuEvidence(
  job: VenueJob,
  result: Record<string, unknown>,
  sourceUrl: string,
  now: string,
): MenuEvidence {
  const items = Array.isArray(result.items) ? result.items : [];
  return {
    kind: "menu",
    placeId: job.candidate.id,
    placeName: asText(result.restaurantName, 160) ?? job.worker.name,
    sourceUrl: asPublicHttpUrl(result.sourceUrl) ?? sourceUrl,
    retrievedAt: now,
    currency: asText(result.currency, 8),
    items: items
      .flatMap((entry) => {
        if (!isRecord(entry)) return [];
        const name = asText(entry.name, 160);
        if (name === null) return [];
        return [
          {
            section: asText(entry.section, 80),
            name,
            description: asText(entry.description, 500),
            price: asNumber(entry.price),
            currency: asText(entry.currency, 8),
            allergenNotes: asText(entry.allergenNotes, 300),
          },
        ];
      })
      .slice(0, 12),
    notes: Array.isArray(result.notes)
      ? result.notes
          .map((entry) => asText(entry, 300))
          .filter((entry): entry is string => entry !== null)
          .slice(0, 8)
      : [],
  };
}

function hotelEvidence(
  job: VenueJob,
  result: Record<string, unknown>,
  sourceUrl: string,
  now: string,
): HotelEvidence {
  return {
    kind: "hotel",
    placeId: job.candidate.id,
    placeName: asText(result.hotelName, 160) ?? job.worker.name,
    sourceUrl: asPublicHttpUrl(result.sourceUrl) ?? sourceUrl,
    retrievedAt: now,
    checkIn: job.checkIn,
    checkOut: job.checkOut,
    travelers: job.travelers,
    roomType: asText(result.roomType, 120),
    nightlyRate: asNumber(result.nightlyRate),
    total: asNumber(result.total),
    taxesAndFees: asNumber(result.taxesAndFees),
    currency: asText(result.currency, 8),
    cancellation: asText(result.cancellation, 300),
    bookingUrl: asPublicHttpUrl(result.bookingUrl),
    notes: Array.isArray(result.notes)
      ? result.notes
          .map((entry) => asText(entry, 300))
          .filter((entry): entry is string => entry !== null)
          .slice(0, 8)
      : [],
  };
}

function evidenceFrom(job: VenueJob, value: unknown, now: string): VenueEvidence | null {
  if (!isRecord(value)) return null;
  return job.kind === "menu"
    ? menuEvidence(job, value, job.url, now)
    : hotelEvidence(job, value, job.url, now);
}

function buildJobs(request: VenueResearchRequest): VenueJob[] {
  const checkOut =
    request.checkIn.length > 0 ? addDaysIso(request.checkIn, request.days) : null;
  const jobs: VenueJob[] = [];
  const stays = request.places.filter((place) => place.category === "stay").slice(0, 2);
  const eats = request.places.filter((place) => place.category === "eat").slice(0, 3);
  for (const candidate of stays) {
    if (checkOut === null || request.checkIn.length === 0) continue;
    const url = candidateUrl(candidate);
    jobs.push({
      worker: {
        id: candidate.id,
        name: candidate.name,
        category: "stay",
        kind: "hotel",
        sourceUrl: url,
      },
      kind: "hotel",
      candidate,
      url,
      fallbackUrl: candidate.sourceUrl !== url ? candidate.sourceUrl : null,
      goal: buildHotelGoal(candidate, request, checkOut),
      schema: HOTEL_SCHEMA as unknown as Record<string, unknown>,
      checkIn: request.checkIn,
      checkOut,
      travelers: request.travelers,
      cacheKey: venueCacheKey({
        kind: "hotel",
        url,
        placeId: candidate.id,
        checkIn: request.checkIn,
        checkOut,
        travelers: request.travelers,
      }),
    });
  }
  for (const candidate of eats) {
    const url = candidateUrl(candidate);
    jobs.push({
      worker: {
        id: candidate.id,
        name: candidate.name,
        category: "eat",
        kind: "menu",
        sourceUrl: url,
      },
      kind: "menu",
      candidate,
      url,
      fallbackUrl: candidate.sourceUrl !== url ? candidate.sourceUrl : null,
      goal: buildMenuGoal(candidate, request.destination),
      schema: MENU_SCHEMA as unknown as Record<string, unknown>,
      checkIn: "",
      checkOut: "",
      travelers: request.travelers,
      cacheKey: venueCacheKey({ kind: "menu", url, placeId: candidate.id }),
    });
  }
  return jobs;
}

function makeSeq(): (worker: string) => number {
  const counters = new Map<string, number>();
  return (worker) => {
    const next = (counters.get(worker) ?? 0) + 1;
    counters.set(worker, next);
    return next;
  };
}

function statusEvent(
  worker: string,
  status: "queued" | "running" | "complete" | "error",
  nextSeq: (worker: string) => number,
  message?: string,
  cached?: true,
): VenueEvent {
  return {
    event: "venue_status",
    data: {
      worker,
      seq: nextSeq(worker),
      ts: nowIso(),
      status,
      ...(message === undefined ? {} : { message }),
      ...(cached === true ? { cached: true } : {}),
    },
  };
}

function cachedPurpose(record: VenueCacheRecord): string {
  const date = checkedLabel(record.evidence.retrievedAt);
  return record.evidence.kind === "hotel"
    ? `Served from the recorded room check on ${date}.`
    : `Served from the recorded menu check on ${date}.`;
}

async function replayCached(
  job: VenueJob,
  record: VenueCacheRecord,
  emit: Emit,
  nextSeq: (worker: string) => number,
): Promise<{ ok: true; evidence: VenueEvidence; cached: true }> {
  const id = job.worker.id;
  emit(statusEvent(id, "complete", nextSeq, cachedPurpose(record), true));
  const sources =
    record.sources.length > 0
      ? record.sources
      : [{ url: record.evidence.sourceUrl, title: `${job.worker.name} page`, api: "fetch" as const }];
  emit({
    event: "venue_sources",
    data: {
      worker: id,
      seq: nextSeq(id),
      ts: nowIso(),
      items: sources,
      cached: true,
    },
  });
  const activity =
    record.activity.length > 0
      ? record.activity.slice(-30)
      : [{ text: cachedPurpose(record), kind: "note" as const, offsetSec: 0 }];
  for (const line of activity) {
    emit({
      event: "venue_activity",
      data: {
        worker: id,
        seq: nextSeq(id),
        ts: nowIso(),
        kind: line.kind,
        text: line.text,
        offsetSec: line.offsetSec,
        cached: true,
      },
    });
  }
  emit({
    event: "venue_result",
    data: {
      worker: id,
      seq: nextSeq(id),
      ts: nowIso(),
      evidence: record.evidence,
      cached: true,
    },
  });
  return { ok: true, evidence: record.evidence, cached: true };
}

async function runJob(
  job: VenueJob,
  apiKey: string,
  signal: AbortSignal,
  emit: Emit,
  nextSeq: (worker: string) => number,
  deadline: number,
): Promise<{ ok: boolean; evidence: VenueEvidence | null; cached: boolean }> {
  const cached = await readCachedVenue(job.cacheKey);
  if (cached !== null) return replayCached(job, cached, emit, nextSeq);

  const startedMs = Date.now();
  const activity: VenueCacheActivity[] = [];
  const sources: VenueSourceItem[] = [];
  const id = job.worker.id;
  const record = (kind: VenueActivityKind, text: string): void => {
    const bounded = text.trim().slice(0, 200);
    if (bounded.length === 0) return;
    activity.push({
      text: bounded,
      kind,
      offsetSec: Math.round((Date.now() - startedMs) / 1000),
    });
    emit({
      event: "venue_activity",
      data: { worker: id, seq: nextSeq(id), ts: nowIso(), kind, text: bounded },
    });
  };
  const addSources = (incoming: VenueSourceItem[]): void => {
    const seen = new Set(sources.map((item) => item.url ?? `title:${item.title ?? ""}`));
    const fresh = incoming.filter((item) => {
      const key = item.url ?? `title:${item.title ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (fresh.length === 0) return;
    sources.push(...fresh);
    emit({
      event: "venue_sources",
      data: { worker: id, seq: nextSeq(id), ts: nowIso(), items: fresh },
    });
  };

  emit(statusEvent(id, "queued", nextSeq, "Preparing the browser check"));
  let attempt = 0;
  for (;;) {
    const remaining = deadline - Date.now();
    if (remaining < MIN_ATTEMPT_MS) {
      emit({
        event: "venue_error",
        data: {
          worker: id,
          seq: nextSeq(id),
          ts: nowIso(),
          code: "timeout",
          message: "The venue run reached its time budget. The plan is unchanged.",
        },
      });
      return { ok: false, evidence: null, cached: false };
    }
    attempt += 1;
    const attemptUrl = attempt === 1 ? job.url : job.fallbackUrl ?? job.url;
    emit(statusEvent(id, "running", nextSeq, "Opening the venue page"));
    const provider = await runProvider(job, attemptUrl, apiKey, signal, (event) => {
      if (event.type === "STREAMING_URL" && event.streamingUrl !== null) {
        emit({
          event: "venue_streaming_url",
          data: {
            worker: id,
            seq: nextSeq(id),
            ts: nowIso(),
            streamingUrl: event.streamingUrl,
          },
        });
      } else if (event.type === "PROGRESS" && event.purpose !== null) {
        record(event.tinyfishApi === "search" ? "search" : "read", event.purpose);
      } else if (event.type === "TF_API_RESULT") {
        addSources(extractSources(event.result, event.tinyfishApi));
      }
    }, remaining);

    if (provider.result !== null) {
      const evidence = evidenceFrom(job, provider.result, nowIso());
      if (evidence === null) {
        emit({
          event: "venue_error",
          data: {
            worker: id,
            seq: nextSeq(id),
            ts: nowIso(),
            code: "invalid_input",
            message: "The venue result could not be read. The plan is unchanged.",
          },
        });
        return { ok: false, evidence: null, cached: false };
      }
      addSources([{ url: evidence.sourceUrl, title: `${job.worker.name} page`, api: "fetch" }]);
      record(
        "note",
        evidence.kind === "hotel"
          ? "Extracted the room rate from the checked page."
          : `Extracted ${evidence.items.length} menu items from the checked page.`,
      );
      const snapshot: VenueCacheRecord = {
        evidence,
        sources,
        activity: activity.slice(-ACTIVITY_LIMIT),
        durationSec: Math.round((Date.now() - startedMs) / 1000),
      };
      await writeCachedVenue(job.cacheKey, snapshot);
      emit({
        event: "venue_result",
        data: { worker: id, seq: nextSeq(id), ts: nowIso(), evidence },
      });
      emit(statusEvent(id, "complete", nextSeq));
      return { ok: true, evidence, cached: false };
    }

    if (signal.aborted) return { ok: false, evidence: null, cached: false };
    if (attempt === 1 && deadline - Date.now() >= MIN_ATTEMPT_MS * 2) {
      record(
        "note",
        job.fallbackUrl === null
          ? "The page check was interrupted. Retrying once."
          : "The preferred page did not answer. Trying the plan's source page.",
      );
      continue;
    }
    emit({
      event: "venue_error",
      data: {
        worker: id,
        seq: nextSeq(id),
        ts: nowIso(),
        code: errorCode(provider.errorCode),
        message: "The venue page could not be checked. The plan is unchanged.",
      },
    });
    return { ok: false, evidence: null, cached: false };
  }
}

/**
 * Runs up to two hotel and three menu jobs with a small parallelism cap and streams every
 * accepted provider event. A missing key fails each worker cleanly and still ends with
 * venue_done.
 */
export async function runVenueResearch(
  request: VenueResearchRequest,
  apiKey: string,
  signal: AbortSignal,
  emit: Emit = () => {},
): Promise<VenueEvidence[]> {
  const jobs = buildJobs(request);
  const nextSeq = makeSeq();
  const deadline = Date.now() + RUN_BUDGET_MS;
  emit({
    event: "venue_started",
    data: { workers: jobs.map((job) => job.worker), ts: nowIso() },
  });

  if (apiKey.trim().length === 0) {
    for (const job of jobs) {
      emit({
        event: "venue_error",
        data: {
          worker: job.worker.id,
          seq: nextSeq(job.worker.id),
          ts: nowIso(),
          code: "missing_api_key",
          message: "The live venue check is not configured on this server.",
        },
      });
    }
    emit({
      event: "venue_done",
      data: {
        ts: nowIso(),
        completed: [],
        failed: jobs.map((job) => job.worker.id),
        summary: { workers: jobs.length, menus: 0, hotels: 0, items: 0, sources: 0 },
      },
    });
    return [];
  }

  const sourceKeys = new Set<string>();
  let menus = 0;
  let hotels = 0;
  let items = 0;
  let cacheHits = 0;
  const wrappedEmit: Emit = (event) => {
    if (event.event === "venue_sources") {
      for (const item of event.data.items) {
        sourceKeys.add(`${event.data.worker}|${item.url ?? item.title ?? ""}`);
      }
    }
    if (event.event === "venue_result") {
      if (event.data.evidence.kind === "menu") {
        menus += 1;
        items += event.data.evidence.items.length;
      } else {
        hotels += 1;
      }
    }
    emit(event);
  };

  const evidence: VenueEvidence[] = [];
  const completed: string[] = [];
  const failed: string[] = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(MAX_PARALLEL, jobs.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      const job = jobs[index];
      if (job === undefined) return;
      const result = await runJob(job, apiKey, signal, wrappedEmit, nextSeq, deadline);
      if (result.evidence !== null) evidence.push(result.evidence);
      if (result.cached) cacheHits += 1;
      if (result.ok) completed.push(job.worker.id);
      else failed.push(job.worker.id);
    }
  });
  await Promise.all(workers);

  emit({
    event: "venue_done",
    data: {
      ts: nowIso(),
      completed,
      failed,
      summary: {
        workers: jobs.length,
        menus,
        hotels,
        items,
        sources: sourceKeys.size,
      },
      ...(jobs.length > 0 && cacheHits === jobs.length ? { cached: true as const } : {}),
    },
  });
  return evidence;
}
