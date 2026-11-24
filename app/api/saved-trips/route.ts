/**
 * GET /api/saved-trips: lists the signed-in account's saved trips.
 * POST /api/saved-trips: stores one validated trip and plan snapshot.
 *
 * Inputs: the Clerk session and, for POST, { runId, trip, plan }.
 * Outputs: summaries, { id }, 400 for an invalid body, or 401 when signed out.
 * Invariants: every query is scoped to the Clerk user id; a mock plan is never stored.
 */

import { readBilling } from "@/lib/billing/server";
import {
  countSavedTrips,
  findSavedTripForRun,
  listSavedTrips,
  saveTrip,
} from "@/lib/db/savedTrips";
import { parseSaveTripBody } from "@/lib/savedTrips";

export const runtime = "nodejs";

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Lists saved trips for the current account. */
export async function GET(): Promise<Response> {
  const { userId } = await readBilling();
  if (userId === null) return json(401, { error: "Sign in to read saved trips." });
  try {
    return json(200, { trips: await listSavedTrips(userId) });
  } catch {
    return json(500, { error: "Saved trips could not be read." });
  }
}

/** Saves or updates one trip snapshot for the current account. */
export async function POST(request: Request): Promise<Response> {
  const { userId, entitlements } = await readBilling();
  if (userId === null) return json(401, { error: "Sign in to save a trip." });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Send a JSON object with the trip and plan." });
  }
  const input = parseSaveTripBody(body, new Date().toISOString());
  if (input === null) {
    return json(400, {
      error: "Send a valid trip and a finished plan. Sample plans cannot be saved.",
    });
  }
  try {
    if (entitlements.savedTripLimit !== null) {
      const existing = await findSavedTripForRun(userId, input.runId);
      if (existing === null) {
        const count = await countSavedTrips(userId);
        if (count >= entitlements.savedTripLimit) {
          return json(403, {
            error: `The Free Preview includes ${entitlements.savedTripLimit} saved trip${entitlements.savedTripLimit === 1 ? "" : "s"}. Upgrade to save more.`,
            code: "saved_trip_limit",
          });
        }
      }
    }
    return json(200, { id: (await saveTrip(userId, input)).id });
  } catch {
    return json(500, { error: "The trip could not be saved. Try again." });
  }
}
