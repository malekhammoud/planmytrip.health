/**
 * GET /api/trips?installId=...: lists recent anonymous trips for one browser.
 *
 * Inputs: an install id query parameter. Outputs: compact trip summaries with the label
 * state, never full dossiers or another install's data.
 */

import { parseInstallId } from "@/lib/data/validation";
import { listTrips } from "@/lib/db/trips";

export const runtime = "nodejs";

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Returns the install-scoped trip log. */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const installId = parseInstallId(url.searchParams.get("installId"));
  if (installId === null) {
    return json(400, { error: "Send a valid install id." });
  }
  try {
    return json(200, { trips: listTrips(installId) });
  } catch {
    return json(500, { error: "The trip log could not be read." });
  }
}
