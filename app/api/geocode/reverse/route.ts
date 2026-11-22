/**
 * GET /api/geocode/reverse: authenticated reverse lookup for current location and map pin.
 *
 * Inputs: lat, lng, and an optional mode (city or place).
 * Outputs: { place: GeocodePlace } or a 400/401/404/502 JSON error.
 * Invariants: the coordinate pair is validated before any provider call; no account id or
 * health field is forwarded; a failed lookup returns calm copy and never a raw provider body.
 */

import { auth } from "@clerk/nextjs/server";
import { reversePlace } from "@/lib/geocode/search";
import type { GeocodePlace } from "@/lib/geocode/types";

export const runtime = "nodejs";

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": status === 200 ? "private, max-age=300" : "no-store",
    },
  });
}

/** Handles one reverse lookup. */
export async function GET(request: Request): Promise<Response> {
  const { userId } = await auth();
  if (userId === null) return json(401, { error: "Sign in to use your location." });
  const url = new URL(request.url);
  const latText = url.searchParams.get("lat");
  const lngText = url.searchParams.get("lon") ?? url.searchParams.get("lng");
  if (
    latText === null ||
    lngText === null ||
    latText.trim().length === 0 ||
    lngText.trim().length === 0
  ) {
    return json(400, { error: "Send a latitude and longitude." });
  }
  const lat = Number(latText);
  const lng = Number(lngText);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return json(400, { error: "Send a latitude and longitude." });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return json(400, { error: "That coordinate is outside the map." });
  }
  const mode = url.searchParams.get("mode") === "city" ? "city" : "place";
  try {
    const place: GeocodePlace | null = await reversePlace(lat, lng, mode);
    if (place === null) {
      return json(404, {
        error: "That point could not be named. Pick another spot or type a city.",
      });
    }
    return json(200, { place });
  } catch {
    return json(502, {
      error: "The location lookup is unavailable. Type the city and country instead.",
    });
  }
}
