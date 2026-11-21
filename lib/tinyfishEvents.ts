/**
 * Maps normalised TinyFish run events onto the swarm's own SSE events.
 *
 * Inputs: one parsed TinyfishEvent plus the worker it belongs to, an optional
 * source URL fallback, and a clock.
 * Outputs: zero or one SwarmEvent; heartbeats, unknown types, and TF_API_RESULT
 * are intentionally silent.
 * Invariants: completion always carries typed findings plus sourceUrl and
 * retrievedAt; malformed result text keeps the raw text and a parse error while
 * every finding stays null or empty. No values are invented.
 */

import { WORKER_SOURCES, emptyFindings, normalizeWorkerResult } from "@/lib/swarmGoals";
import type { TinyfishEvent } from "@/lib/tinyfish";
import type { SwarmEvent, WorkerId } from "@/lib/swarmTypes";

/** Context needed to attribute an upstream event to one worker. */
export interface UpstreamMappingContext {
  worker: WorkerId;
  /** Page the worker was asked to read; defaults to the canonical worker source. */
  sourceUrl?: string;
  /** Clock injected so tests can pin timestamps. */
  now: () => string;
}

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
          rawResult: result,
          parseError: "The agent returned JSON that is not an object. Showing the raw result.",
        };
      }
      return normalizeWorkerResult(worker, parsed, fallbackSourceUrl);
    } catch {
      return {
        findings: emptyFindings(worker),
        sourceUrl: fallbackSourceUrl,
        rawResult: result,
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
      rawResult: JSON.stringify(result) ?? String(result),
      parseError: "The agent returned JSON that is not an object. Showing the raw result.",
    };
  }
  return normalizeWorkerResult(worker, result, fallbackSourceUrl);
}

function mapComplete(
  event: Extract<TinyfishEvent, { type: "COMPLETE" }>,
  context: UpstreamMappingContext,
): SwarmEvent {
  const ts = context.now();
  const sourceUrl = context.sourceUrl ?? WORKER_SOURCES[context.worker];
  if (event.status !== "COMPLETED") {
    const message =
      event.status === "CANCELLED"
        ? "The agent run was cancelled. Retry this check."
        : "The agent could not complete this check. Retry this worker.";
    return {
      event: "worker_error",
      data: {
        worker: context.worker,
        ts,
        code: "upstream_error",
        message,
      },
    };
  }
  const normalized = normalizeCompleteResult(event.result, context.worker, sourceUrl);
  return {
    event: "worker_complete",
    data: {
      worker: context.worker,
      ts,
      findings: normalized.findings,
      sourceUrl: normalized.sourceUrl,
      retrievedAt: ts,
      rawResult: normalized.rawResult,
      parseError: normalized.parseError,
    },
  };
}

/**
 * Converts one upstream event into at most one swarm event.
 * STARTED becomes a running status; HEARTBEAT and TF_API_RESULT are ignored.
 */
export function mapTinyfishEvent(
  event: TinyfishEvent,
  context: UpstreamMappingContext,
): SwarmEvent | null {
  switch (event.type) {
    case "STARTED":
      return {
        event: "worker_status",
        data: { worker: context.worker, ts: context.now(), status: "running" },
      };
    case "STREAMING_URL": {
      const streamingUrl = event.streamingUrl?.trim() ?? "";
      // The URL is passed to an iframe, so only absolute HTTP(S) previews are safe.
      if (streamingUrl === "" || !isHttpUrl(streamingUrl)) return null;
      return {
        event: "streaming_url",
        data: {
          worker: context.worker,
          ts: context.now(),
          streamingUrl,
        },
      };
    }
    case "PROGRESS": {
      if (event.purpose === null) return null;
      return {
        event: "worker_progress",
        data: { worker: context.worker, ts: context.now(), purpose: event.purpose },
      };
    }
    case "COMPLETE":
      return mapComplete(event, context);
    case "HEARTBEAT":
    case "TF_API_RESULT":
      // TF_API_RESULT is documented as optional but its payload is not specified;
      // COMPLETE.result is the authoritative result for this route.
      return null;
  }
}
