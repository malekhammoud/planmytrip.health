/**
 * Server-side billing context.
 *
 * Inputs: the current Clerk request. Outputs: the user id and its effective plan limits.
 * Invariants: one `auth()` call per resource; a missing session returns free limits, and
 * every protected resource still decides whether a null user is allowed.
 */

import { auth } from "@clerk/nextjs/server";
import {
  entitlementsFromHas,
  type BillingEntitlements,
} from "./plans";

/** The current account's identity and entitlement snapshot. */
export interface BillingContext {
  userId: string | null;
  entitlements: BillingEntitlements;
}

/** Reads the current Clerk session and maps its plan claims to product limits. */
export async function readBilling(): Promise<BillingContext> {
  const { userId, has } = await auth();
  return {
    userId,
    entitlements: entitlementsFromHas(has),
  };
}
