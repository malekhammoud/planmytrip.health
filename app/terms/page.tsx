import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { DestinationAd } from "@/components/ads/DestinationAd";

export const metadata: Metadata = {
  title: "Terms - PlanMyTrip.health",
  description:
    "The plain-language terms for using PlanMyTrip.health, including accounts, billing, acceptable use, and the planning-aid limits.",
};

/**
 * Public terms of use. It is a plain-language summary of the shipped service, not a
 * substitute for advice from a lawyer or a clinician.
 */
export default function TermsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader publicView />
      <main className="page-container flex-1 pb-16 pt-12 md:pb-24 md:pt-20">
        <p className="t-label text-muted">Terms</p>
        <h1 className="t-display measure mt-3">The rules, plainly.</h1>
        <p className="t-body measure mt-5 text-muted">
          Last updated 25 November 2026. These terms cover your use of PlanMyTrip.health.
          By using the service, you agree to them.
        </p>

        <div className="mt-10">
          <DestinationAd variant="inline" intent="plan" placement="terms" />
        </div>

        <div className="measure mt-10 flex flex-col gap-10">
          <section aria-labelledby="terms-service">
            <h2 id="terms-service" className="t-title text-ink">
              What the service is
            </h2>
            <p className="t-small mt-3 text-muted">
              PlanMyTrip.health helps you plan a trip around a health profile. It produces
              a paced itinerary, a route, a modeled safety envelope, a care card, and
              optional live page checks. It is a planning aid. It is not medical advice,
              diagnosis, treatment, a prescription, or an emergency service. Do not rely on
              it for a medical decision, and call local emergency services when you need
              urgent help.
            </p>
            <p className="t-small mt-3 text-muted">
              Conditions, pacing limits, and scores are modeled estimates. Confirm them
              with your clinician and your travel insurer. Live pages, menus, room rates,
              opening hours, and advisories can change after a check.
            </p>
          </section>

          <section aria-labelledby="terms-accounts">
            <h2 id="terms-accounts" className="t-title text-ink">
              Accounts
            </h2>
            <p className="t-small mt-3 text-muted">
              You need a Clerk account to plan and save trips. Keep your sign-in details
              secure and give accurate information. You are responsible for activity under
              your account. Tell us promptly if you believe someone else has access.
            </p>
          </section>

          <section aria-labelledby="terms-billing">
            <h2 id="terms-billing" className="t-title text-ink">
              Plans and billing
            </h2>
            <p className="t-small mt-3 text-muted">
              The Free Preview includes one live plan a calendar year, trips up to seven
              days, and one saved trip. Care Circle is $9 per month or $60 per year in USD
              and includes two live plans a month, trips up to 20 days, live destination
              checks, live venue checks, and unlimited saved trips. The safety envelope
              and care card stay free.
            </p>
            <p className="t-small mt-3 text-muted">
              Clerk Billing processes the subscription and payment. Prices, taxes, and
              available intervals are shown at checkout. Subscriptions renew until
              cancelled. Cancel or change a plan from the account page. Refunds are
              handled under the applicable law and the payment provider&apos;s terms.
            </p>
          </section>

          <section aria-labelledby="terms-use">
            <h2 id="terms-use" className="t-title text-ink">
              Acceptable use
            </h2>
            <p className="t-small mt-3 text-muted">
              Do not use the service to break the law, harm someone, scrape or resell the
              service, probe its infrastructure, bypass a plan limit, or run automated
              browser checks at scale. Do not upload another person&apos;s health
              information without permission. We may suspend an account that abuses the
              live checks or the service.
            </p>
          </section>

          <section aria-labelledby="terms-content">
            <h2 id="terms-content" className="t-title text-ink">
              Content and ownership
            </h2>
            <p className="t-small mt-3 text-muted">
              You keep the trip information you enter. We keep the service, the pacing
              engine, the interface, and the research pipeline. A plan is for your personal
              trip planning. Linked pages, menus, rates, maps, and advisories belong to
              their owners and keep their own terms. Cite the source when you share a fact.
            </p>
          </section>

          <section aria-labelledby="terms-availability">
            <h2 id="terms-availability" className="t-title text-ink">
              Availability and liability
            </h2>
            <p className="t-small mt-3 text-muted">
              The service is provided as available. Live checks depend on third-party pages
              and providers, so a check can fail, time out, or return an older cached
              result. We do not guarantee that a plan is complete, current, or suitable for
              you. To the extent permitted by law, we are not liable for indirect or
              incidental losses, and our total liability is limited to the amount you paid
              us in the 12 months before the claim. Nothing here excludes a liability that
              cannot be excluded by law.
            </p>
          </section>

          <section aria-labelledby="terms-law">
            <h2 id="terms-law" className="t-title text-ink">
              Governing law and contact
            </h2>
            <p className="t-small mt-3 text-muted">
              These terms are governed by the laws of Ontario, Canada. If a dispute cannot
              be resolved informally, the courts of Ontario have jurisdiction. Questions
              can go to{" "}
              <a
                href="mailto:hello@planmytrip.health"
                className="text-accent hover:underline"
              >
                hello@planmytrip.health
              </a>
              .
            </p>
          </section>

          <p className="t-small border-t border-hairline pt-4 text-muted">
            Planning aid only. Not medical advice. Confirm health and travel insurance
            details before you travel.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
