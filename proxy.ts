/**
 * Clerk proxy integration for the App Router.
 *
 * Inputs: document and API requests. Outputs: Clerk auth headers, response cookies, and
 * the same-origin Frontend API proxy at /__clerk.
 * Invariants: only Clerk's auth request headers are forwarded; each page and API still
 * performs its own auth check. The header filter is required on Next 16.4.6.
 */

import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const clerk = clerkMiddleware({
  signInUrl: "/sign-in",
  signUpUrl: "/sign-up",
  frontendApiProxy: {
    enabled: true,
  },
});

/**
 * Next 16.4.6 hangs when Clerk forwards the full request header override set.
 * Forward only the Clerk auth headers and any response cookies; the rest of the
 * request is left untouched.
 */
function forwardClerkResponse(result: Response): Response {
  if (!result.headers.has("x-middleware-rewrite")) return result;
  const auth = new Headers();
  for (const [key, value] of result.headers.entries()) {
    if (key.startsWith("x-middleware-request-x-clerk-")) {
      auth.append(key.slice("x-middleware-request-".length), value);
    }
  }
  const next = NextResponse.next({ request: { headers: auth } });
  for (const [key, value] of result.headers.entries()) {
    if (key.toLowerCase() === "set-cookie") next.headers.append("set-cookie", value);
    else if (key.startsWith("x-clerk-")) next.headers.set(key, value);
  }
  return next;
}

export default async function proxy(
  request: NextRequest,
  event: NextFetchEvent,
): Promise<Response> {
  const result = await clerk(request, event);
  if (!(result instanceof Response)) return NextResponse.next();
  return forwardClerkResponse(result);
}
