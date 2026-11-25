/**
 * POST /api/agent-plan: validates a trip request and streams the OpenCode concierge
 * team's live research, specialist results, and final plan.
 *
 * Inputs: a JSON body validated by parsePlannerRequest, plus the optional AGENT_MOCK
 * dev flag. Outputs: planner SSE frames or a 400/401/403/429/503 JSON error.
 * Invariants: every connected stream ends with planner_done; a live plan reserves its
 * allowance atomically before any model work; cached and mock runs never reserve; the
 * account holds at most one live planner slot until the stream finishes, cancels, or
 * fails; the OpenCode client is server-only and no secret or raw provider error is echoed.
 */

import { billingPeriodStart, planLabel } from "@/lib/billing/plans";
import { readBilling } from "@/lib/billing/server";
import { reserveBillingUsage } from "@/lib/db/billingUsage";
import { runPlanner } from "@/lib/agent/agentRunner";
import { parsePlannerRequest } from "@/lib/agent/agentRequest";
import { buildCachedPlannerEvents } from "@/lib/cache/cachedEvents";
import { readCachedPlan, writeCachedPlan } from "@/lib/cache/planCache";
import { capturePlannerRun } from "@/lib/data/capture";
import type { AgentResultSummary } from "@/lib/data/types";
import {
  liveChecksDisabled,
  plannerConcurrency,
} from "@/lib/liveLimits";
import { settleWithin } from "@/lib/ops/pendingWrites";
import type { ConcurrencyDenialReason } from "@/lib/concurrency";
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

function jsonError(status: number, message: string, code?: string): Response {
  return new Response(JSON.stringify({ error: message, ...(code ? { code } : {}) }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function rateLimitError(reason: ConcurrencyDenialReason, retryAfterSec: number): Response {
  const message =
    reason === "cooldown"
      ? "A live plan just finished. Wait a few seconds and try again."
      : reason === "global"
        ? "Live planning is busy right now. Try again in a moment."
        : "A live plan is already running for this account. Try again in a moment.";
  const response = jsonError(429, message, "rate_limited");
  response.headers.set("Retry-After", String(Math.max(1, Math.trunc(retryAfterSec))));
  return response;
}

/** Handles one concierge request. Invalid bodies get JSON; valid bodies get SSE. */
export async function POST(request: Request): Promise<Response> {
  const { userId, entitlements } = await readBilling();
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
      "Send a destination, 2 to 20 days, a supported condition, preferences, and a budget.",
    );
  }
  if (plannerRequest.days > entitlements.maxTripDays) {
    return jsonError(
      403,
      `The ${entitlements.plan === "free_user" ? "Free" : "current"} plan includes trips up to ${entitlements.maxTripDays} days. Upgrade to plan a longer trip.`,
      "plan_limit",
    );
  }

  const mock =
    process.env.AGENT_MOCK === "1" && process.env.NODE_ENV !== "production";
  // A cache hit skips the OpenCode runtime entirely, so a known trip is one fast
  // replay of validated results rather than a six-to-twelve-minute research run.
  const cached = mock ? null : await readCachedPlan(plannerRequest).catch(() => null);
  const livePlan = !mock && cached === null;
  let releasePlanner: ((options?: { cooldown?: boolean }) => void) | null = null;

  if (livePlan) {
    if (liveChecksDisabled()) {
      return jsonError(
        503,
        "Live planning is paused right now. Cached plans and the safety envelope still work.",
        "live_disabled",
      );
    }
    const grant = plannerConcurrency().acquire(userId);
    if (!grant.ok) return rateLimitError(grant.reason, grant.retryAfterSec);
    releasePlanner = grant.lease.release;

    // The reservation is the usage event: one transaction locks, counts, and inserts.
    // A database failure fails closed instead of granting an unmetered live run.
    const reservation = await reserveBillingUsage(
      userId,
      "plan",
      billingPeriodStart(entitlements.tripPeriod),
      entitlements.tripsPerPeriod,
    );
    if (reservation !== "reserved") {
      releasePlanner({ cooldown: false });
      releasePlanner = null;
      if (reservation === "limit") {
        return jsonError(
          403,
          `The ${planLabel(entitlements.plan)} plan includes ${entitlements.tripsPerPeriod} live ${entitlements.tripsPerPeriod === 1 ? "trip" : "trips"} per ${entitlements.tripPeriod}. Cached plans remain available. Upgrade to plan another live trip.`,
          "trip_limit",
        );
      }
      return jsonError(
        503,
        "Live planning is temporarily unavailable. Try again in a moment.",
        "billing_unavailable",
      );
    }
  }

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

  const release = (): void => {
    if (releasePlanner === null) return;
    const releaseFn = releasePlanner;
    releasePlanner = null;
    releaseFn();
  };

  const emit = (event: PlannerEvent): void => {
    if (event.event === "agent_result" && event.data.agentId !== "concierge") {
      research.push({
        agentId: event.data.agentId,
        ok: event.data.ok,
        summary: event.data.summary.slice(0, 400),
      });
    }
    if (event.event === "plan_ready" && cached === null) {
      // Only a live run creates a dossier. A cached replay has no new consent signal
      // and must never add a duplicate training row.
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
    }
    if (event.event === "plan_ready" && livePlan) {
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
    release();
    if (closed) return;
    closed = true;
    try {
      controllerRef?.close();
    } catch {
      // The consumer already closed the stream.
    }
  };

  const settlePending = async (): Promise<void> => {
    // A hung database must not hold planner_done open. Writes continue best-effort.
    await settleWithin(pendingCaptures);
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
        void settlePending().finally(finish);
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
          await settlePending();
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
