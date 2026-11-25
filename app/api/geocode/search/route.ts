/**
 * GET /api/geocode/search: authenticated destination autocomplete.
 *
 * Inputs: q (2-120 characters) and an optional limit (1-8).
 * Outputs: { results: GeocodePlace[] } or a 400/401/502 JSON error.
 * Invariants: only the query leaves the server; no account id or health field is sent;
 * responses are private and short-lived; provider failures use calm copy.
 */

import { auth } from "@clerk/nextjs/server";
import { searchPlaces } from "@/lib/geocode/search";
import type { GeocodePlace } from "@/lib/geocode/types";
import { geocodeLimiter } from "@/lib/liveLimits";

export const runtime = "nodejs";

function json(
  status: number,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": status === 200 ? "private, max-age=60" : "no-store",
      ...headers,
    },
  });
}

/** Handles one autocomplete query. */
export async function GET(request: Request): Promise<Response> {
  const { userId } = await auth();
  if (userId === null) return json(401, { error: "Sign in to search for a destination." });
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().replace(/\s+/g, " ");
  if (query.length < 2 || query.length > 120) {
    return json(400, { error: "Type at least two characters of a city or place." });
  }
  const limitParam = Number(url.searchParams.get("limit") ?? "6");
  const limit = Number.isFinite(limitParam)
    ? Math.max(1, Math.min(8, Math.trunc(limitParam)))
    : 6;
  const allowance = geocodeLimiter().consume(userId);
  if (!allowance.allowed) {
    return json(
      429,
      {
        error: "Too many destination searches. Wait a moment and try again.",
        code: "rate_limited",
      },
      { "Retry-After": String(allowance.retryAfterSec) },
    );
  }
  try {
    const results: GeocodePlace[] = await searchPlaces(query, limit);
    return json(200, { results });
  } catch {
    return json(502, {
      error: "Destination search is unavailable. Type the city and country instead.",
    });
  }
}
