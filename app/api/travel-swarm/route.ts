/**
 * POST /api/travel-swarm: validates the request and streams the swarm's own SSE events
 * while lib/swarmRunner executes the three TinyFish research workers concurrently.
 *
 * Inputs: a JSON body { destination, condition, medication, workers? } validated by
 * isSwarmRequestBody, plus TINYFISH_API_KEY and the dev-only SWARM_MOCK flag.
 * Outputs: text/event-stream frames (worker_status, streaming_url, worker_progress,
 * worker_complete, worker_error, swarm_done) or a 400 JSON error for a bad body.
 * Invariants: every stream ends with swarm_done; enqueues are guarded after close; the
 * API key is never logged, echoed, or placed in an event.
 */

import { KEEP_ALIVE_MS, runSwarm, type SwarmRunContext } from "@/lib/swarmRunner";
import {
  encodeSwarmEvent,
  isSwarmRequestBody,
  resolveWorkers,
  type SwarmEvent,
} from "@/lib/swarmTypes";

export const runtime = "nodejs";
export const maxDuration = 120;

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
  const input: SwarmRunContext["input"] = {
    destination: body.destination.trim(),
    condition: body.condition,
    medication: body.medication.trim(),
  };
  const apiKey = process.env.TINYFISH_API_KEY?.trim() ?? "";
  const mock = process.env.SWARM_MOCK === "1" && process.env.NODE_ENV !== "production";

  const encoder = new TextEncoder();
  const abort = new AbortController();
  let closed = false;
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  let keepAlive: ReturnType<typeof setInterval> | null = null;

  const stopKeepAlive = (): void => {
    if (keepAlive !== null) {
      clearInterval(keepAlive);
      keepAlive = null;
    }
  };

  const emit = (event: SwarmEvent): void => {
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
      void runSwarm(workers, context, mock)
        .catch(() => {
          // The runner guarantees swarm_done; this prevents an unhandled rejection.
        })
        .finally(finish);
    },
    cancel() {
      abort.abort();
      finish();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
