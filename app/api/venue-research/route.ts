/**
 * POST /api/venue-research: authenticated TinyFish menu and hotel extraction.
 *
 * Inputs: a validated venue-research request with selected plan places.
 * Outputs: an SSE stream of venue_* frames, always ending with venue_done, or a 400/401
 * JSON error for a bad body.
 * Invariants: only supplied http(s) URLs reach TinyFish; no recording is requested; a
 * missing key is reported per worker and still ends with venue_done; cached evidence is
 * replayed instantly; no raw provider body is echoed.
 */

import { readBilling } from "@/lib/billing/server";
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
