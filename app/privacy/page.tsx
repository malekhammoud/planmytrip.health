import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Privacy - PlanMyTrip.health",
  description:
    "How PlanMyTrip.health handles account data, saved trips, anonymous research, live checks, feedback, and operational logs.",
};

/**
 * Public privacy notice. It describes the shipped data flows in plain language and keeps
 * the anonymous research capture separate from the Clerk account.
 */
export default function PrivacyPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader publicView />
      <main className="page-container flex-1 pb-16 pt-12 md:pb-24 md:pt-20">
        <p className="t-label text-muted">Privacy</p>
        <h1 className="t-display measure mt-3">Your data, plainly.</h1>
        <p className="t-body measure mt-5 text-muted">
          Last updated 25 November 2026. This notice describes what PlanMyTrip.health
          handles, why, and the choices you have. It is a planning aid, not medical
          advice.
        </p>

        <div className="measure mt-10 flex flex-col gap-10">
          <section aria-labelledby="privacy-account">
            <h2 id="privacy-account" className="t-title text-ink">
              Account and saved trips
            </h2>
            <p className="t-small mt-3 text-muted">
              Clerk provides sign-in and billing. It handles your name, email address,
              authentication, payment method, invoices, and subscription status. We do not
              store a password or a separate copy of your payment details.
            </p>
            <p className="t-small mt-3 text-muted">
              When you save a trip, we store the destination, dates, party size, health
              profile, preferences, and the plan snapshot in our PostgreSQL database under
              your Clerk user id. You can delete a saved trip from its page. Deleting your
              account removes your saved trips and billing-usage counter, then closes the
              Clerk account.
            </p>
          </section>

          <section aria-labelledby="privacy-research">
            <h2 id="privacy-research" className="t-title text-ink">
              Anonymous research is separate
            </h2>
            <p className="t-small mt-3 text-muted">
              The research capture is optional and off by default. If you opt in, we store
              the trip labels, the computed pacing dose, bounded agent summaries, and the
              one outcome you choose to report. It is keyed by a random install id in your
              browser, not by your Clerk account. We use it to calibrate pacing estimates.
            </p>
            <p className="t-small mt-3 text-muted">
              Because the research capture is not linked to your account, closing your
              account does not remove it. To delete the anonymous capture from this
              browser, clear this site&apos;s local storage, or contact us and we will help.
              An unanswered outcome is never treated as a negative result.
            </p>
          </section>

          <section aria-labelledby="privacy-live">
            <h2 id="privacy-live" className="t-title text-ink">
              Live checks and place lookups
            </h2>
            <p className="t-small mt-3 text-muted">
              A live destination check sends the destination and health profile to our
              TinyFish browser service, which reads the Government of Canada travel
              advisory page. Venue checks send the selected menu or booking URL, the trip
              dates, and the party size to TinyFish. Geocoding sends the place text or
              coordinates to Photon or Nominatim. Map tiles are requested from the
              configured OpenStreetMap-compatible tile provider. When you choose a Google
              Maps link, Google receives the stops in that link.
            </p>
            <p className="t-small mt-3 text-muted">
              These services receive only what the check needs. We do not send your Clerk
              identity, saved-trip list, or outcome label to them.
            </p>
          </section>

          <section aria-labelledby="privacy-other">
            <h2 id="privacy-other" className="t-title text-ink">
              Feedback and operations
            </h2>
            <p className="t-small mt-3 text-muted">
              Feedback asks for a category, a rating, a message, the page, the release, and
              a random feedback id. Please do not include personal health details. Error
              reports record the route, release, and a bounded error reference so we can
              fix failures; they are not used to build an advertising profile.
            </p>
          </section>

          <section aria-labelledby="privacy-retention">
            <h2 id="privacy-retention" className="t-title text-ink">
              How long we keep it
            </h2>
            <p className="t-small mt-3 text-muted">
              Saved trips stay until you delete them or close your account. Consented
              research stays until you ask us to delete it or we retire the research
              program. Planner cache entries expire after 30 days, destination-check cache
              entries after 14 days, venue menus after 7 days, and room rates after 12
              hours. Operational logs are kept for a short troubleshooting window. We do
              not sell your data.
            </p>
          </section>

          <section aria-labelledby="privacy-choices">
            <h2 id="privacy-choices" className="t-title text-ink">
              Your choices
            </h2>
            <p className="t-small mt-3 text-muted">
              You can use the planner without opting into research. You can delete saved
              trips individually or delete your account from the account page. You can
              clear this site&apos;s local storage to remove the anonymous install id from
              your browser. For access, correction, or deletion requests, email{" "}
              <a
                href="mailto:privacy@planmytrip.health"
                className="text-accent hover:underline"
              >
                privacy@planmytrip.health
              </a>
              .
            </p>
          </section>

          <section aria-labelledby="privacy-security">
            <h2 id="privacy-security" className="t-title text-ink">
              Security and children
            </h2>
            <p className="t-small mt-3 text-muted">
              We use TLS, a private database connection, parameterized queries, and
              server-only secrets. No system is perfectly secure. The service is intended
              for adults and is not directed to children under 18.
            </p>
          </section>

          <section aria-labelledby="privacy-contact">
            <h2 id="privacy-contact" className="t-title text-ink">
              Changes and contact
            </h2>
            <p className="t-small mt-3 text-muted">
              We will update this notice when the product or the law changes. Questions or
              requests can go to{" "}
              <a
                href="mailto:privacy@planmytrip.health"
                className="text-accent hover:underline"
              >
                privacy@planmytrip.health
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
