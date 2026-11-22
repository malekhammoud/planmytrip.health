/**
 * GET /api/trips?installId=...: lists recent anonymous trips for one browser.
 *
 * Inputs: a signed-in Clerk session and an install id. Outputs: compact trip summaries
 * with the label state, never full dossiers or another install's data. This is the
 * anonymous research log, not the account-owned saved-trip list.
 */

import { auth } from "@clerk/nextjs/server";
import { parseInstallId } from "@/lib/data/validation";
import { listTrips } from "@/lib/db/trips";

export const runtime = "nodejs";

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Returns the install-scoped trip log. A header is preferred so proxy logs stay clean. */
export async function GET(request: Request): Promise<Response> {
  const { userId } = await auth();
  if (userId === null) return json(401, { error: "Sign in to read the trip log." });
  const url = new URL(request.url);
  const installId = parseInstallId(
    request.headers.get("x-install-id") ?? url.searchParams.get("installId"),
  );
  if (installId === null) {
    return json(400, { error: "Send a valid install id." });
  }
  try {
    return json(200, { trips: await listTrips(installId) });
  } catch {
    return json(500, { error: "The trip log could not be read." });
  }
}
