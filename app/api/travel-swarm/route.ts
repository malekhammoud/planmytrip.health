/**
 * POST /api/travel-swarm: validates the request and streams the swarm's own SSE events
 * while lib/swarmRunner executes the three TinyFish research workers concurrently.
 *
 * Inputs: a JSON body { destination, condition, medication, workers? } validated by
 * isSwarmRequestBody, plus TINYFISH_API_KEY and the dev-only SWARM_MOCK flag.
 * Outputs: text/event-stream frames (worker_status, worker_started, streaming_url,
 * worker_progress, worker_sources, worker_heartbeat, worker_note, worker_complete,
 * worker_error, swarm_done) or a 400 JSON error for a bad body.
 * Invariants: every stream ends with swarm_done; enqueues are guarded after close; the
 * API key is never logged, echoed, or placed in an event.
 */

import { auth } from "@clerk/nextjs/server";
import { buildCachedSwarmEvents } from "@/lib/cache/cachedEvents";
import { archiveSwarmCache } from "@/lib/cache/swarmArchive";
import { readCachedSwarm, type SwarmCacheWriteWorker } from "@/lib/cache/swarmCache";
import { captureSwarmFindings } from "@/lib/data/capture";
import type { WorkerFindingSummary } from "@/lib/data/types";
import { mergeSources } from "@/lib/swarmReducer";
import { KEEP_ALIVE_MS, runSwarm, type SwarmRunContext } from "@/lib/swarmRunner";
import {
  encodeSwarmEvent,
  isSwarmRequestBody,
  normalizeSwarmText,
  resolveWorkers,
  type SwarmEvent,
  type SwarmSourceItem,
  type TinyfishApi,
  type WorkerId,
} from "@/lib/swarmTypes";

export const runtime = "nodejs";
export const maxDuration = 300;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
} as const;

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Handles one swarm request. Invalid bodies get JSON; valid bodies get an SSE stream. */
export async function POST(request: Request): Promise<Response> {
  const { userId } = await auth();
  if (userId === null) {
    return jsonError(401, "Sign in to start live verification.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Send a JSON object with destination, condition, and medication.");
  }
  if (!isSwarmRequestBody(body)) {
    return jsonError(
      400,
      "Send a destination, a supported condition, a medication value, and a non-empty worker list.",
    );
  }

  const workers = resolveWorkers(body.workers);
  const runBody = body;
  const input: SwarmRunContext["input"] = {
    destination: normalizeSwarmText(body.destination),
    condition: body.condition,
    medication: normalizeSwarmText(body.medication),
  };
  const apiKey = process.env.TINYFISH_API_KEY?.trim() ?? "";
  const mock = process.env.SWARM_MOCK === "1" && process.env.NODE_ENV !== "production";
  // Cached verification skips all three paid browser runs. A miss runs the live swarm
  // and stores the complete set for the next request.
  const cached = mock ? null : await readCachedSwarm(input, workers).catch(() => null);
  const fromCache = cached !== null;

  const encoder = new TextEncoder();
  const abort = new AbortController();
  let closed = false;
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  let keepAlive: ReturnType<typeof setInterval> | null = null;
  const findings: WorkerFindingSummary[] = [];
  const pendingCaptures: Promise<void>[] = [];
  const sources: Partial<Record<WorkerId, SwarmSourceItem[]>> = {};
  const purposes: Partial<Record<WorkerId, { purpose: string; tinyfishApi?: TinyfishApi }[]>> = {};
  const runIds: Partial<Record<WorkerId, string>> = {};
  const startedAt: Partial<Record<WorkerId, string>> = {};
  const completions: Partial<Record<WorkerId, SwarmCacheWriteWorker>> = {};

  const stopKeepAlive = (): void => {
    if (keepAlive !== null) {
      clearInterval(keepAlive);
      keepAlive = null;
    }
  };

  const emit = (event: SwarmEvent): void => {
    if (event.event === "worker_started") {
      startedAt[event.data.worker] = event.data.startedAt;
      if (event.data.runId !== null) runIds[event.data.worker] = event.data.runId;
    }
    if (event.event === "worker_sources") {
      sources[event.data.worker] = mergeSources(
        sources[event.data.worker] ?? [],
        event.data.items,
      );
    }
    if (event.event === "worker_progress") {
      const next = purposes[event.data.worker] ?? [];
      purposes[event.data.worker] = [
        ...next,
        {
          purpose: event.data.purpose,
          ...(event.data.tinyfishApi === undefined
            ? {}
            : { tinyfishApi: event.data.tinyfishApi }),
        },
      ].slice(-200);
    }
    if (event.event === "worker_complete") {
      const worker = event.data.worker;
      completions[worker] = {
        findings: event.data.findings,
        sourceUrl: event.data.sourceUrl,
        retrievedAt: event.data.retrievedAt,
        ...(startedAt[worker] === undefined ? {} : { startedAt: startedAt[worker] }),
        endedAt: event.data.ts,
        sources: sources[worker] ?? [],
        purposes: purposes[worker] ?? [],
        ...(event.data.rawResult === undefined ? {} : { rawResult: event.data.rawResult }),
        ...(event.data.parseError === undefined ? {} : { parseError: event.data.parseError }),
        ...(event.data.recordingUrl === undefined
          ? {}
          : { recordingUrl: event.data.recordingUrl }),
      };
      findings.push({
        worker,
        ok: true,
        sourceUrl: event.data.sourceUrl,
        retrievedAt: event.data.retrievedAt,
        // Keep enough of the typed result to seed a complete verification cache from a
        // capture row; 800 characters truncated the coverage checklist.
        summary: JSON.stringify(event.data.findings).slice(0, 4_000),
      });
    }
    if (event.event === "worker_error") {
      findings.push({
        worker: event.data.worker,
        ok: false,
        sourceUrl: null,
        retrievedAt: null,
        summary: event.data.message.slice(0, 400),
      });
    }
    if (
      event.event === "swarm_done" &&
      (!mock || process.env.PLANMYTRIP_CAPTURE_MOCK === "1")
    ) {
      pendingCaptures.push(
        captureSwarmFindings({
          request: runBody,
          findings,
          now: event.data.ts,
        }).catch(() => {
          // Capture is best-effort; the verification stream must still close cleanly.
        }),
      );
    }
    if (
      event.event === "swarm_done" &&
      !mock &&
      !fromCache &&
      workers.length === 3 &&
      event.data.completed.length === workers.length &&
      event.data.failed.length === 0
    ) {
      // Recordings and the cache write finish after the stream's terminal frame, so a
      // long video download never delays the live result.
      void archiveSwarmCache({
        identity: input,
        workers,
        values: completions,
        runIds,
        apiKey,
        now: event.data.ts,
      }).catch(() => {
        // A cache miss on the next request is harmless.
      });
    }
    if (closed || controllerRef === null || abort.signal.aborted) return;
    try {
      controllerRef.enqueue(encoder.encode(encodeSwarmEvent(event)));
    } catch {
      closed = true;
      stopKeepAlive();
    }
  };

  const onRequestAbort = (): void => {
    abort.abort();
  };
  if (request.signal.aborted) abort.abort();
  else request.signal.addEventListener("abort", onRequestAbort, { once: true });

  const finish = (): void => {
    stopKeepAlive();
    request.signal.removeEventListener("abort", onRequestAbort);
    if (closed) return;
    closed = true;
    try {
      controllerRef?.close();
    } catch {
      // The consumer already closed the stream.
    }
  };

  const context: SwarmRunContext = { input, apiKey, emit, signal: abort.signal };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      keepAlive = setInterval(() => {
        if (closed || controllerRef === null || abort.signal.aborted) return;
        try {
          controllerRef.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          closed = true;
          stopKeepAlive();
        }
      }, KEEP_ALIVE_MS);
      if (cached !== null) {
        for (const event of buildCachedSwarmEvents(cached, workers)) emit(event);
        void Promise.allSettled(pendingCaptures).finally(finish);
        return;
      }

      void runSwarm(workers, context, mock)
        .catch(() => {
          // The runner guarantees swarm_done; this prevents an unhandled rejection.
        })
        .finally(async () => {
          await Promise.allSettled(pendingCaptures);
          finish();
        });
    },
    cancel() {
      abort.abort();
      finish();
    },
  });

  return new Response(stream, {
    headers: {
      ...SSE_HEADERS,
      "X-Swarm-Cache": cached === null ? "miss" : "hit",
    },
  });
}
