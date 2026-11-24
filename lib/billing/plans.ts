/**
 * Billing plan vocabulary and entitlement mapping.
 *
 * Inputs: Clerk's `has()` authorization helper. Outputs: one plain entitlement object
 * consumed by pages, hooks, and route handlers.
 * Invariants: free limits are enforced when Clerk Billing is unavailable or a feature is
 * missing; paid limits only widen a capability inside the engine's documented maximum.
 */

import { TRIP_DAYS_MAX } from "@/lib/healthTripTypes";

/** The existing Clerk free plan slug. */
export const FREE_PLAN_SLUG = "free_user";

/** Paid user plans, in display order. Slugs must match Clerk Billing exactly. */
export const PAID_PLANS = [
  { slug: "care_circle", label: "Care Circle" },
] as const;

/** One paid plan slug. */
export type PaidPlanSlug = (typeof PAID_PLANS)[number]["slug"];

/** Any plan slug the interface can display. */
export type PlanSlug = typeof FREE_PLAN_SLUG | PaidPlanSlug;

/** Feature slugs attached to plans in Clerk Billing. */
export const BILLING_FEATURES = {
  longTrips: "long_trips",
  liveVerification: "live_verification",
  venueResearch: "venue_research",
  unlimitedSavedTrips: "saved_trips_unlimited",
} as const;

/** Display labels for the plan badge and pricing page. */
export const PLAN_LABELS: Readonly<Record<PlanSlug, string>> = {
  free_user: "Free Preview",
  care_circle: "Care Circle",
};

/** Free trips stay inside the high-confidence profile range. */
export const FREE_MAX_TRIP_DAYS = 7;

/** Free accounts keep one saved plan. */
export const FREE_SAVED_TRIP_LIMIT = 1;

/** The reset window for a live-plan allowance. */
export type TripPeriod = "month" | "year";

/** Product limits for one plan. Counts are enforced in the server routes. */
export interface PlanLimits {
  /** Live (uncached) concierge plans per allowance window. */
  tripsPerPeriod: number;
  /** Whether the allowance resets monthly or yearly. */
  tripPeriod: TripPeriod;
  maxTripDays: number;
  /** Null means unlimited. */
  savedTripLimit: number | null;
  liveVerification: boolean;
  venueResearch: boolean;
}

/** The UTC start of the monthly or yearly allowance window. */
export function billingPeriodStart(
  period: TripPeriod,
  now = new Date(),
): string {
  const year = now.getUTCFullYear();
  if (period === "year") return `${year}-01-01`;
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

/** The launch catalog. Clerk plan slugs and this map must stay in sync. */
export const PLAN_LIMITS: Readonly<Record<PlanSlug, PlanLimits>> = {
  free_user: {
    tripsPerPeriod: 1,
    tripPeriod: "year",
    maxTripDays: FREE_MAX_TRIP_DAYS,
    savedTripLimit: FREE_SAVED_TRIP_LIMIT,
    liveVerification: false,
    venueResearch: false,
  },
  care_circle: {
    tripsPerPeriod: 2,
    tripPeriod: "month",
    maxTripDays: TRIP_DAYS_MAX,
    savedTripLimit: null,
    liveVerification: true,
    venueResearch: true,
  },
};

/** The two authorization checks this module needs from Clerk's `has()`. */
export type BillingCheck =
  | { plan: string; feature?: never; role?: never; permission?: never }
  | { feature: string; plan?: never; role?: never; permission?: never };

/** The subset of Clerk's `has()` signature this module needs. */
export type BillingHas = (params: BillingCheck) => boolean;

/** One account's effective product limits. */
export interface BillingEntitlements extends PlanLimits {
  plan: PlanSlug;
}

function allows(has: BillingHas, params: BillingCheck): boolean {
  try {
    return has(params);
  } catch {
    // A missing or disabled billing configuration must fall back to the free limits.
    return false;
  }
}

/** Maps Clerk's session claims to the product's explicit limits. */
export function entitlementsFromHas(has: BillingHas): BillingEntitlements {
  const plan = PAID_PLANS.find((candidate) => allows(has, { plan: candidate.slug }));
  const planSlug = plan?.slug ?? FREE_PLAN_SLUG;
  const base = PLAN_LIMITS[planSlug];
  return {
    plan: planSlug,
    tripsPerPeriod: base.tripsPerPeriod,
    tripPeriod: base.tripPeriod,
    maxTripDays: allows(has, { feature: BILLING_FEATURES.longTrips })
      ? TRIP_DAYS_MAX
      : FREE_MAX_TRIP_DAYS,
    savedTripLimit: allows(has, {
      feature: BILLING_FEATURES.unlimitedSavedTrips,
    })
      ? null
      : FREE_SAVED_TRIP_LIMIT,
    liveVerification: allows(has, {
      feature: BILLING_FEATURES.liveVerification,
    }),
    venueResearch: allows(has, {
      feature: BILLING_FEATURES.venueResearch,
    }),
  };
}

/** True when the account is on a paid plan. */
export function isPaidPlan(plan: PlanSlug): plan is PaidPlanSlug {
  return plan !== FREE_PLAN_SLUG;
}

/** Human label for a plan slug. */
export function planLabel(plan: PlanSlug): string {
  return PLAN_LABELS[plan];
}
