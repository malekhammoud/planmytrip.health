/**
 * GET /api/saved-trips/[id]: reads one owned trip snapshot.
 * DELETE /api/saved-trips/[id]: removes one owned trip snapshot.
 *
 * Invariants: the Clerk user id scopes both reads and deletes; malformed ids are 400;
 * another account's trip is indistinguishable from an unknown trip.
 */

import { auth } from "@clerk/nextjs/server";
import { deleteSavedTrip, getSavedTrip } from "@/lib/db/savedTrips";
import { parseSavedTripId } from "@/lib/savedTrips";

export const runtime = "nodejs";

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Reads one saved trip. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await auth();
  if (userId === null) return json(401, { error: "Sign in to read a saved trip." });
  const id = parseSavedTripId((await context.params).id);
  if (id === null) return json(400, { error: "That saved-trip id is not valid." });
  try {
    const trip = await getSavedTrip(userId, id);
    if (trip === null) return json(404, { error: "That saved trip was not found." });
    return json(200, { trip });
  } catch {
    return json(500, { error: "The saved trip could not be read." });
  }
}

/** Deletes one saved trip. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await auth();
  if (userId === null) return json(401, { error: "Sign in to delete a saved trip." });
  const id = parseSavedTripId((await context.params).id);
  if (id === null) return json(400, { error: "That saved-trip id is not valid." });
  try {
    if (!(await deleteSavedTrip(userId, id))) {
      return json(404, { error: "That saved trip was not found." });
    }
    return json(200, { ok: true });
  } catch {
    return json(500, { error: "The saved trip could not be deleted." });
  }
}
