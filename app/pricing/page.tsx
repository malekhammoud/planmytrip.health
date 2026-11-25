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
  title: "Plans and pricing - PlanMyTrip.health",
  description:
    "A day-by-day plan, a route, and a safety envelope with daily limits. Compare the free plan with Care Circle.",
};

const FREE_INCLUDES = [
  "Day-by-day plan and route",
  "Safety envelope with daily limits",
  "Care card to share with your group",
  "One live plan a year",
  "Trips up to 7 days",
  "One saved trip",
] as const;

const CARE_CIRCLE_INCLUDES = [
  "Everything in Free Preview",
  "Up to two live plans a month",
  "Trips up to 20 days",
  "Live menu and room-rate checks",
  "Live destination advisory check",
  "Unlimited saved trips",
] as const;

function PlanIncludes({ label, items }: { label: string; items: readonly string[] }) {
  return (
    <ul aria-label={`${label} includes`} className="mt-4 list-none p-0">
      {items.map((item) => (
        <li key={item} className="t-small border-t border-hairline py-3 text-ink">
          {item}
        </li>
      ))}
    </ul>
  );
}

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
        <h1 className="t-display measure mt-3">Plans for the way you travel.</h1>
        <p className="t-body measure mt-5 text-muted">
          Every plan gives you a day-by-day itinerary, a route with maps, a safety
          envelope with daily limits, and a care card you can share. Care Circle adds
          longer trips and live checks of your destination and the places you choose.
        </p>
        <p className="t-small measure mt-3 text-muted">
          Care Circle is $9 per month or $60 per year, in USD.
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

        <section
          aria-labelledby="compare-plans"
          className="mt-12 border-t border-hairline pt-8"
        >
          <h2 id="compare-plans" className="t-title">
            What each plan includes
          </h2>
          <div className="mt-6 grid gap-10 md:grid-cols-2 md:gap-16">
            <div>
              <p className="t-label text-muted">Free Preview</p>
              <p className="t-heading mt-2">$0</p>
              <p className="t-small mt-1 text-muted">For the occasional trip.</p>
              <PlanIncludes label="Free Preview" items={FREE_INCLUDES} />
            </div>
            <div>
              <p className="t-label text-muted">Care Circle</p>
              <p className="t-heading mt-2">$9 / month</p>
              <p className="t-small mt-1 text-muted">or $60 a year, in USD.</p>
              <PlanIncludes label="Care Circle" items={CARE_CIRCLE_INCLUDES} />
            </div>
          </div>
          <p className="t-small measure mt-6 text-muted">
            The safety envelope, daily limits, and care card stay free on every plan.
          </p>
        </section>

        <div className="mt-12">
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
