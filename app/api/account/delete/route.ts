/**
 * POST /api/account/delete: closes the signed-in account and removes its saved data.
 *
 * Inputs: the Clerk session. Outputs: a calm JSON success or failure.
 * Invariants: the request is authenticated; database cleanup is parameterized and comes
 * first; the Clerk user is deleted only after account data is gone; anonymous research
 * captures and the shared cache are not touched.
 */

import { clerkClient } from "@clerk/nextjs/server";
import { readBilling } from "@/lib/billing/server";
import { deleteAccountData } from "@/lib/db/account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Rejects a browser request whose Origin is not this host. */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host === null) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Deletes account-owned rows, then the Clerk account. */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return jsonError(403, "This request did not come from PlanMyTrip.health.");
  }
  const { userId } = await readBilling();
  if (userId === null) return jsonError(401, "Sign in to delete your account.");

  try {
    await deleteAccountData(userId);
  } catch {
    return jsonError(
      503,
      "Your account data could not be removed right now. Try again in a moment.",
    );
  }

  try {
    const client = await clerkClient();
    await client.users.deleteUser(userId);
  } catch {
    return jsonError(
      502,
      "Your saved data was removed, but the account could not be closed. Contact hello@planmytrip.health.",
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
