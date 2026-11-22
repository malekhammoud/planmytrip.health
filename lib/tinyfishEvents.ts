/**
 * Maps normalised TinyFish run events onto the swarm's own SSE events.
 *
 * Inputs: one parsed TinyfishEvent plus the worker it belongs to, a source URL fallback,
 * a clock, and a per-worker sequence source.
 * Outputs: zero or one SwarmEvent. HEARTBEAT becomes worker_heartbeat, TF_API_RESULT
 * becomes worker_sources, and unknown upstream types are counted by the client.
 * Invariants: completion always carries typed findings plus sourceUrl and retrievedAt;
 * malformed result text keeps the raw text and a parse error while every finding stays
 * null or empty. Source rows only read string url and title fields, so an undocumented
 * upstream shape can never throw. No values are invented.
 */

import { WORKER_SOURCES, emptyFindings, normalizeWorkerResult } from "@/lib/swarmGoals";
import type { TinyfishEvent } from "@/lib/tinyfish";
import type {
  SwarmErrorCode,
  SwarmEvent,
  SwarmSourceItem,
  TinyfishApi,
  WorkerId,
} from "@/lib/swarmTypes";

/** Context needed to attribute an upstream event to one worker. */
export interface UpstreamMappingContext {
  worker: WorkerId;
  /** Page the worker was asked to read; defaults to the canonical worker source. */
  sourceUrl?: string;
  /** Clock injected so tests can pin timestamps. */
  now: () => string;
  /** Monotonic sequence for this worker, called only for events that are emitted. */
  nextSeq: () => number;
}

const MAX_SOURCES_PER_EVENT = 10;
const MAX_SOURCE_TEXT = 200;

// VERIFY: TF_API_RESULT is documented as an array with an unspecified item shape. This
// build reads only direct string url and title fields and ignores everything else; check
// the real shape after the next production run and only then widen the reader.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function envelope(context: UpstreamMappingContext) {
  return { worker: context.worker, seq: context.nextSeq(), ts: context.now() };
}

/** Upstream text is untrusted; keep every forwarded string small enough to render. */
const PURPOSE_MAX = 200;
const URL_MAX = 2_000;
const RAW_MAX = 2_000;

function bounded(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Rebuilds source rows from a TF_API_RESULT payload. Only a direct array of objects
 * with string url or title fields is read; any other shape yields an empty list.
 */
export function extractSources(
  result: unknown,
  api: TinyfishApi | null,
): SwarmSourceItem[] {
  if (api === null || !Array.isArray(result)) return [];
  const seen = new Set<string>();
  const items: SwarmSourceItem[] = [];
  for (const entry of result.slice(0, MAX_SOURCES_PER_EVENT)) {
    if (!isRecord(entry)) continue;
    const rawUrl = typeof entry.url === "string" ? entry.url.trim() : "";
    const url =
      rawUrl !== "" && rawUrl.length <= URL_MAX && isHttpUrl(rawUrl) ? rawUrl : undefined;
    const rawTitle = typeof entry.title === "string" ? entry.title.trim() : "";
    const title =
      rawTitle === "" ? undefined : bounded(rawTitle, MAX_SOURCE_TEXT);
    if (url === undefined && title === undefined) continue;
    const key = url ?? `title:${title ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ ...(url === undefined ? {} : { url }), ...(title === undefined ? {} : { title }), api });
  }
  return items;
}

/** Maps one upstream error code or error string onto a UI branch. */
export function mapTinyfishErrorCode(code: string | null | undefined): SwarmErrorCode {
  const token = (code ?? "").toUpperCase();
  if (token.includes("SITE_BLOCKED")) return "site_blocked";
  if (token.includes("MAX_STEPS_EXCEEDED")) return "max_steps_exceeded";
  if (token.includes("RATE_LIMIT") || token.includes("DAILY_LIMIT")) return "rate_limit";
  if (token.includes("INSUFFICIENT_CREDITS")) return "insufficient_credits";
  if (token.includes("INVALID_INPUT")) return "invalid_input";
  if (token.includes("FORBIDDEN")) return "forbidden";
  if (token.includes("CANCELLED")) return "cancelled";
  if (token.includes("TIMEOUT")) return "timeout";
  if (token.includes("MISSING_API_KEY") || token.includes("INVALID_API_KEY")) {
    return "missing_api_key";
  }
  return "upstream_error";
}

interface NormalizedComplete {
  findings: ReturnType<typeof emptyFindings>;
  sourceUrl: string;
  rawResult?: string;
  parseError?: string;
}

function normalizeCompleteResult(
  result: unknown,
  worker: WorkerId,
  fallbackSourceUrl: string,
): NormalizedComplete {
  if (typeof result === "string") {
    try {
      const parsed: unknown = JSON.parse(result);
      if (!isRecord(parsed)) {
        return {
          findings: emptyFindings(worker),
          sourceUrl: fallbackSourceUrl,
          rawResult: bounded(result, RAW_MAX),
          parseError: "The agent returned JSON that is not an object. Showing the raw result.",
        };
      }
      return normalizeWorkerResult(worker, parsed, fallbackSourceUrl);
    } catch {
      return {
        findings: emptyFindings(worker),
        sourceUrl: fallbackSourceUrl,
        rawResult: bounded(result, RAW_MAX),
        parseError: "The agent returned text that is not valid JSON. Showing the raw result.",
      };
    }
  }
  if (result === null || result === undefined) {
    return { findings: emptyFindings(worker), sourceUrl: fallbackSourceUrl };
  }
  if (!isRecord(result)) {
    return {
      findings: emptyFindings(worker),
      sourceUrl: fallbackSourceUrl,
      rawResult: bounded(JSON.stringify(result) ?? String(result), RAW_MAX),
      parseError: "The agent returned JSON that is not an object. Showing the raw result.",
    };
  }
  return normalizeWorkerResult(worker, result, fallbackSourceUrl);
}

const FAILED_MESSAGES: Record<string, string> = {
  site_blocked: "The site blocked the agent. Retry this check.",
  max_steps_exceeded: "The agent hit its step limit before finishing.",
  timeout: "The agent did not finish inside its time limit. Retry this check.",
  cancelled: "The agent run was cancelled. Retry this check.",
  rate_limit: "TinyFish rate limit reached. Try again in a minute.",
  insufficient_credits: "The TinyFish account has no credits left. Check the plan.",
  missing_api_key: "The live agent check is not configured on this server.",
};

function mapComplete(
  event: Extract<TinyfishEvent, { type: "COMPLETE" }>,
  context: UpstreamMappingContext,
): SwarmEvent {
  const sourceUrl = context.sourceUrl ?? WORKER_SOURCES[context.worker];
  if (event.status !== "COMPLETED") {
    const code = mapTinyfishErrorCode(event.error ?? event.status);
    return {
      event: "worker_error",
      data: {
        ...envelope(context),
        code,
        message: FAILED_MESSAGES[code] ?? "The agent could not complete this check. Retry this worker.",
      },
    };
  }
  const normalized = normalizeCompleteResult(event.result, context.worker, sourceUrl);
  return {
    event: "worker_complete",
    data: {
      ...envelope(context),
      findings: normalized.findings,
      sourceUrl: normalized.sourceUrl,
      retrievedAt: context.now(),
      rawResult: normalized.rawResult,
      parseError: normalized.parseError,
    },
  };
}

/**
 * Converts one upstream event into at most one swarm event. STARTED opens the run,
 * HEARTBEAT keeps the connection honest, and TF_API_RESULT adds source rows.
 */
export function mapTinyfishEvent(
  event: TinyfishEvent,
  context: UpstreamMappingContext,
): SwarmEvent | null {
  switch (event.type) {
    case "STARTED":
      return {
        event: "worker_started",
        data: {
          ...envelope(context),
          runId: event.runId,
          startedAt: context.now(),
        },
      };
    case "STREAMING_URL": {
      const streamingUrl = event.streamingUrl?.trim() ?? "";
      // The URL is passed to an iframe, so only absolute HTTP(S) previews are safe and
      // bounded; an unexpectedly long URL is rejected rather than truncated into a
      // different destination.
      if (streamingUrl === "" || streamingUrl.length > URL_MAX) return null;
      if (!isHttpUrl(streamingUrl)) return null;
      return {
        event: "streaming_url",
        data: {
          ...envelope(context),
          streamingUrl,
        },
      };
    }
    case "PROGRESS": {
      if (event.purpose === null) return null;
      const purpose = bounded(event.purpose.trim(), PURPOSE_MAX);
      if (purpose.length === 0) return null;
      return {
        event: "worker_progress",
        data: {
          ...envelope(context),
          purpose,
          ...(event.tinyfishApi === null ? {} : { tinyfishApi: event.tinyfishApi }),
        },
      };
    }
    case "HEARTBEAT":
      return { event: "worker_heartbeat", data: envelope(context) };
    case "TF_API_RESULT": {
      const items = extractSources(event.result, event.tinyfishApi);
      if (items.length === 0) return null;
      return { event: "worker_sources", data: { ...envelope(context), items } };
    }
    case "COMPLETE":
      return mapComplete(event, context);
  }
}
