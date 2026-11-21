/**
 * POST /api/agent-plan: validates a trip request and streams the OpenCode concierge
 * team's live research, specialist results, and final plan.
 *
 * Inputs: a JSON body validated by parsePlannerRequest, plus the optional AGENT_MOCK
 * dev flag. Outputs: planner SSE frames or a 400 JSON error.
 * Invariants: every connected stream ends with planner_done; the OpenCode client is
 * server-only; no API key, session secret, or raw provider error is echoed.
 */

import { runPlanner } from "@/lib/agent/agentRunner";
import { parsePlannerRequest } from "@/lib/agent/agentRequest";
import {
  encodePlannerEvent,
  PLANNER_AGENT_IDS,
  type PlannerEvent,
} from "@/lib/agent/agentTypes";

export const runtime = "nodejs";
export const maxDuration = 900;

const KEEP_ALIVE_MS = 15_000;

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

/** Handles one concierge request. Invalid bodies get JSON; valid bodies get SSE. */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Send a JSON object with the trip request.");
  }
  const plannerRequest = parsePlannerRequest(body);
  if (plannerRequest === null) {
    return jsonError(
      400,
      "Send a destination, 2 to 7 days, a supported condition, a medication value, preferences, and a budget.",
    );
  }

  const mock =
    process.env.AGENT_MOCK === "1" && process.env.NODE_ENV !== "production";
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

  const emit = (event: PlannerEvent): void => {
    if (closed || controllerRef === null || abort.signal.aborted) return;
    try {
      controllerRef.enqueue(encoder.encode(encodePlannerEvent(event)));
    } catch {
      closed = true;
      stopKeepAlive();
    }
  };

  const onRequestAbort = (): void => abort.abort();
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

      void runPlanner(plannerRequest, { emit, signal: abort.signal }, mock)
        .catch(() => {
          emit({
            event: "planner_error",
            data: {
              code: "upstream_error",
              message: "The planning team could not finish. Try again in a moment.",
              ts: new Date().toISOString(),
            },
          });
          emit({
            event: "planner_done",
            data: {
              completed: [],
              failed: [...PLANNER_AGENT_IDS],
              ts: new Date().toISOString(),
            },
          });
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
