/**
 * POST /api/venue-research: authenticated TinyFish menu and hotel extraction.
 *
 * Inputs: a validated venue-research request with selected plan places.
 * Outputs: an SSE stream of venue_* frames, always ending with venue_done, or a
 * 400/401/403/429/503 JSON error for a bad body, a limit, or the kill switch.
 * Invariants: only supplied public http(s) URLs reach TinyFish; one live pass per
 * account with a daily cap; no recording is requested; a missing key is reported per
 * worker and still ends with venue_done; cached evidence is replayed instantly; no raw
 * provider body is echoed.
 */

import { readBilling } from "@/lib/billing/server";
import type { ConcurrencyDenialReason } from "@/lib/concurrency";
import {
  liveChecksDisabled,
  venueConcurrency,
  venueDailyLimit,
} from "@/lib/liveLimits";
import { runVenueResearch } from "@/lib/venue/runner";
import { encodeVenueEvent, parseVenueResearchRequest, type VenueEvent } from "@/lib/venue/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const KEEP_ALIVE_MS = 15_000;

function jsonError(status: number, message: string, code?: string): Response {
  return new Response(JSON.stringify({ error: message, ...(code ? { code } : {}) }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function rateLimitError(
  reason: ConcurrencyDenialReason | "daily",
  retryAfterSec: number,
): Response {
  const message =
    reason === "daily"
      ? "The daily live venue check limit is reached. Try again tomorrow."
      : reason === "cooldown"
        ? "A live venue check just finished. Wait a few seconds and try again."
        : reason === "global"
          ? "Live venue checks are busy right now. Try again in a moment."
          : "A live venue check is already running for this account. Try again in a moment.";
  const response = jsonError(429, message, "rate_limited");
  response.headers.set("Retry-After", String(Math.max(1, Math.trunc(retryAfterSec))));
  return response;
}

/** Handles one venue-research stream. */
export async function POST(request: Request): Promise<Response> {
  const { userId, entitlements } = await readBilling();
  if (userId === null) return jsonError(401, "Sign in to check venue details.");
  if (!entitlements.venueResearch) {
    return jsonError(
      403,
      "Live menus and room rates are included in Care Circle. Upgrade to check venue details.",
      "upgrade_required",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Send a JSON object with the selected places.");
  }
  const parsed = parseVenueResearchRequest(body);
  if (parsed === null) {
    return jsonError(
      400,
      "Send a destination, trip dates, and up to eight restaurants or hotels.",
    );
  }

  if (liveChecksDisabled()) {
    return jsonError(
      503,
      "Live venue checks are paused right now. The plan and saved facts still work.",
      "live_disabled",
    );
  }
  const grant = venueConcurrency().acquire(userId);
  if (!grant.ok) return rateLimitError(grant.reason, grant.retryAfterSec);
  let releaseVenue: ((options?: { cooldown?: boolean }) => void) | null =
    grant.lease.release;
  const daily = venueDailyLimit().consume(userId);
  if (!daily.allowed) {
    releaseVenue({ cooldown: false });
    releaseVenue = null;
    return rateLimitError("daily", daily.retryAfterSec);
  }

  const apiKey = process.env.TINYFISH_API_KEY?.trim() ?? "";
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

  const release = (): void => {
    if (releaseVenue === null) return;
    const releaseFn = releaseVenue;
    releaseVenue = null;
    releaseFn();
  };

  const emit = (event: VenueEvent): void => {
    if (closed || controllerRef === null || abort.signal.aborted) return;
    try {
      controllerRef.enqueue(encoder.encode(encodeVenueEvent(event)));
    } catch {
      closed = true;
      stopKeepAlive();
    }
  };

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

  const onRequestAbort = (): void => abort.abort();
  if (request.signal.aborted) abort.abort();
  else request.signal.addEventListener("abort", onRequestAbort, { once: true });

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

      void runVenueResearch(parsed, apiKey, abort.signal, emit)
        .catch(() => {
          // The runner guarantees venue_done; this prevents an unhandled rejection.
        })
        .finally(() => {
          request.signal.removeEventListener("abort", onRequestAbort);
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
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
