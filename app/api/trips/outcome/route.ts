/**
 * POST /api/trips/outcome: records the post-trip label for one anonymous run.
 *
 * Inputs: { runId, installId, outcome: { flare, ... } }.
 * Outputs: { ok: true }, 400 for an invalid body, or 404 when the run is unknown to the
 * install. Invariants: an outcome requires an explicit boolean; the install id scopes
 * the write; no response echoes trip data.
 */

import { parseOutcome } from "@/lib/data/tripDossier";
import { parseInstallId, parseRunId } from "@/lib/data/validation";
import { saveOutcome } from "@/lib/db/trips";

export const runtime = "nodejs";

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Handles one outcome submission. */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Send a JSON object with the trip outcome." });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return json(400, { error: "Send a JSON object with the trip outcome." });
  }
  const record = body as Record<string, unknown>;
  const runId = parseRunId(record.runId);
  const installId = parseInstallId(record.installId);
  if (runId === null || installId === null) {
    return json(400, { error: "Send a valid run id and install id." });
  }
  const outcome = parseOutcome(record.outcome, new Date().toISOString());
  if (outcome === null) {
    return json(400, {
      error: "Answer whether you had a flare. Silence is not a negative.",
    });
  }
  try {
    if (!(await saveOutcome(runId, installId, outcome))) {
      return json(404, { error: "That trip was not found for this browser." });
    }
    return json(200, { ok: true });
  } catch {
    return json(500, { error: "The outcome could not be saved. Try again." });
  }
}
