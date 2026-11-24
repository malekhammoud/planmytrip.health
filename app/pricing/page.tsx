import { PricingTable } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Callout, LinkButton } from "@/components/ui";
import { entitlementsFromHas, isPaidPlan, planLabel } from "@/lib/billing/plans";
import { CLERK_APPEARANCE } from "@/lib/clerkAppearance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Plans - PlanMyTrip.health",
  description:
    "Choose a PlanMyTrip.health plan for health-first trip planning, live venue checks, and saved trips.",
};

/**
 * Public pricing page. Clerk renders the configured plans and checkout drawer; the
 * current plan label comes from the signed-in session. Paid capabilities are enforced
 * again in every server route.
 */
export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { userId, has } = await auth();
  const entitlements = entitlementsFromHas(has);
  const checkout = (await searchParams).checkout;
  const paid = isPaidPlan(entitlements.plan);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader publicView={userId === null} />
      <main className="page-container flex-1 pt-12 md:pt-20">
        <p className="t-label text-muted">Plans</p>
        <h1 className="t-display measure mt-3">Plan around your health.</h1>
        <p className="t-body measure mt-5 text-muted">
          Start with the safety envelope and a saved trip. Care Circle adds up to two live
          plans a month, longer trips, live browser checks of menus and room rates, and more
          room for the places you keep.
        </p>
        <p className="t-small measure mt-3 text-muted">
          Care Circle is $9 per month or $60 per year. Annual is the better value.
          Billing is in USD.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <p className="t-data-sm text-muted">
            Current plan · <span className="text-ink">{planLabel(entitlements.plan)}</span>
          </p>
          {userId !== null ? (
            <LinkButton href="/account" variant="secondary">
              Account and billing
            </LinkButton>
          ) : (
            <LinkButton href="/sign-up" variant="secondary">
              Create an account
            </LinkButton>
          )}
        </div>

        {checkout === "success" ? (
          <div className="mt-8">
            <Callout
              tone={paid ? "info" : "caution"}
              title={paid ? "Plan active" : "Plan change received"}
            >
              <p>
                {paid
                  ? "Your paid plan is active on this account."
                  : "We are confirming the new plan. Refresh this page if it does not appear."}
              </p>
            </Callout>
          </div>
        ) : null}

        <div className="mt-10">
          <Suspense
            fallback={
              <p className="t-small text-muted">Loading the current plans.</p>
            }
          >
            <PricingTable
              appearance={CLERK_APPEARANCE}
              newSubscriptionRedirectUrl="/pricing?checkout=success"
            />
          </Suspense>
        </div>

        <p className="t-small measure mt-10 border-t border-hairline pt-4 text-muted">
          The price toggle switches between annual and monthly billing. Annual is selected
          by default. Clerk Billing processes subscriptions in USD. Cancel or change a plan
          from your account. Planning aid only. Not medical advice.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
