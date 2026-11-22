/**
 * POST /api/agent-plan: validates a trip request and streams the OpenCode concierge
 * team's live research, specialist results, and final plan.
 *
 * Inputs: a JSON body validated by parsePlannerRequest, plus the optional AGENT_MOCK
 * dev flag. Outputs: planner SSE frames or a 400 JSON error.
 * Invariants: every connected stream ends with planner_done; the OpenCode client is
 * server-only; no API key, session secret, or raw provider error is echoed.
 */

import { auth } from "@clerk/nextjs/server";
import { runPlanner } from "@/lib/agent/agentRunner";
import { parsePlannerRequest } from "@/lib/agent/agentRequest";
import { buildCachedPlannerEvents } from "@/lib/cache/cachedEvents";
import { readCachedPlan, writeCachedPlan } from "@/lib/cache/planCache";
import { capturePlannerRun } from "@/lib/data/capture";
import type { AgentResultSummary } from "@/lib/data/types";
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
  const { userId } = await auth();
  if (userId === null) return jsonError(401, "Sign in to plan a trip.");

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
  // A cache hit skips the OpenCode runtime entirely, so a known trip is one fast
  // replay of validated results rather than a six-to-twelve-minute research run.
  const cached = mock ? null : await readCachedPlan(plannerRequest).catch(() => null);
  const encoder = new TextEncoder();
  const abort = new AbortController();
  let closed = false;
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  let keepAlive: ReturnType<typeof setInterval> | null = null;
  const research: AgentResultSummary[] = [];
  const pendingCaptures: Promise<void>[] = [];

  const stopKeepAlive = (): void => {
    if (keepAlive !== null) {
      clearInterval(keepAlive);
      keepAlive = null;
    }
  };

  const emit = (event: PlannerEvent): void => {
    if (event.event === "agent_result" && event.data.agentId !== "concierge") {
      research.push({
        agentId: event.data.agentId,
        ok: event.data.ok,
        summary: event.data.summary.slice(0, 400),
      });
    }
    if (event.event === "plan_ready") {
      pendingCaptures.push(
        capturePlannerRun({
          request: plannerRequest,
          plan: event.data.plan,
          research,
          now: event.data.ts,
        }).catch(() => {
          // Capture is best-effort; the live plan must still render.
        }),
      );
      if (!mock && cached === null) {
        pendingCaptures.push(
          writeCachedPlan(
            plannerRequest,
            {
              plan: event.data.plan,
              research,
              completed: event.data.completed,
              failed: event.data.failed,
            },
            event.data.ts,
          ).catch(() => {
            // Cache writes never delay or fail a live plan.
          }),
        );
      }
    }
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

      if (cached !== null) {
        for (const event of buildCachedPlannerEvents(cached)) emit(event);
        void Promise.allSettled(pendingCaptures).finally(finish);
        return;
      }

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
      "X-Plan-Cache": cached === null ? "miss" : "hit",
    },
  });
}
