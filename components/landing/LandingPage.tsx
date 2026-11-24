/**
 * The public landing page.
 *
 * Inputs: no data; the page reads as a server component and renders real product captures.
 * Outputs: the marketing narrative, product shots, proof points, and the account CTA.
 * Invariants: every screenshot is a real capture of this app with sample data; every claim
 * matches the shipped product; the safety disclaimer stays visible in the footer.
 */

import { LinkButton } from "@/components/ui";
import { LogoMark } from "@/components/Logo";
import { ProductShot } from "@/components/landing/ProductShot";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

const PILLARS = [
  {
    number: "01",
    title: "A ceiling, not a guess.",
    copy:
      "The biological engine turns a condition into daily step and walking limits, required recovery, and a modeled score. The agents plan inside those limits; they cannot lift them.",
  },
  {
    number: "02",
    title: "Seven specialists, one plan.",
    copy:
      "Stay, table, trail, culture, transit, and care agents research in parallel. A lead concierge sequences their verified picks into days that fit the trip.",
  },
  {
    number: "03",
    title: "Live pages, checked now.",
    copy:
      "TinyFish opens real menus and booking pages in real browsers. Every dish and rate keeps its source and checked time, so the plan reflects the page today.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Tell us what matters.",
    copy:
      "Destination, dates, condition, medication, budget, and how you want to get around. Autocomplete, current location, and a map pin do the geography.",
  },
  {
    number: "02",
    title: "Let the team research.",
    copy:
      "Six specialists gather verified places while the engine sets each day's ceiling. The concierge turns the research into one sequenced route.",
  },
  {
    number: "03",
    title: "Travel inside the limit.",
    copy:
      "Open the numbered map, the day-by-day route, the safety envelope, and the care card. Save the trip and reopen it when you need it.",
  },
];

/** The public home page for signed-out visitors. */
export function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader publicView />

      <main>
        <section className="page-container pb-16 pt-12 md:pb-24 md:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div className="min-w-0">
              <p className="t-label text-muted">Health-first travel planning</p>
              <h1 className="t-display mt-4 max-w-[15ch] text-ink">
                The only <span className="whitespace-nowrap">health-focused</span> trip planner.
              </h1>
              <p className="t-body measure mt-6 text-muted">
                Plan around your condition, your pacing, and what you can actually do each
                day. Seven specialists build the route. A deterministic engine keeps the
                ceiling. TinyFish checks the live menus and room rates.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <LinkButton
                  variant="primary"
                  href="/sign-up"
                  external={false}
                >
                  Plan a trip
                </LinkButton>
                <LinkButton
                  variant="secondary"
                  href="/pricing"
                  external={false}
                >
                  See plans
                </LinkButton>
              </div>
              <p className="t-data-sm mt-6 text-muted">
                Account required · Planning aid, not medical advice
              </p>
            </div>

            <div className="min-w-0">
              <ProductShot
                src="/landing/venue-detail.webp"
                alt="The PlanMyTrip.health venue research deck showing four checked pages, a hotel rate of 199 dollars a night, and three menus with 12 items each."
                width={1200}
                height={1067}
                priority
                sizes="(min-width: 1024px) 54vw, 100vw"
                caption="Checked venue evidence · London, Ontario · 4 days"
              />
            </div>
          </div>
        </section>

        <section className="border-y border-solid border-hairline bg-sunken">
          <div className="page-container grid gap-8 py-8 md:grid-cols-3 md:py-10">
            <div>
              <p className="t-metric text-ink">45.1%</p>
              <p className="t-small mt-2 measure text-muted">
                of Canadians live with at least one major chronic disease.
              </p>
            </div>
            <div>
              <p className="t-metric text-ink">1 in 12</p>
              <p className="t-small mt-2 measure text-muted">
                live with three or more. The trip has to fit all of them.
              </p>
            </div>
            <div>
              <p className="t-metric text-ink">0 / 5</p>
              <p className="t-small mt-2 measure text-muted">
                major travel planners asked for a health condition in our review.
              </p>
            </div>
          </div>
          <div className="page-container pb-6">
            <p className="t-data-sm text-muted">
              Statistics Canada, 2021 · AARP, 2026 · PlanMyTrip.health review of Google Travel,
              Tripadvisor, Expedia, Booking.com, and Kayak, 2026.
            </p>
          </div>
        </section>

        <section className="page-container py-16 md:py-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
            <div>
              <p className="t-label text-muted">What is different</p>
              <h2 className="t-title mt-2 text-ink">
                Built around the body, not the itinerary.
              </h2>
              <p className="t-body measure mt-4 text-muted">
                A beautiful plan is not a safe plan. The engine owns the daily limit; the
                concierge owns the sequence. The interface shows both, so the traveler can
                see why a day is shaped the way it is.
              </p>
            </div>
            <ol className="list-none p-0">
              {PILLARS.map((pillar) => (
                <li
                  key={pillar.number}
                  className="grid grid-cols-[3rem_minmax(0,1fr)] gap-4 border-t border-solid border-hairline-strong py-5 first:border-t-0 first:pt-0"
                >
                  <p className="t-data text-accent">{pillar.number}</p>
                  <div>
                    <h3 className="t-heading text-ink">{pillar.title}</h3>
                    <p className="t-small measure mt-1 text-muted">{pillar.copy}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          id="product"
          className="scroll-mt-20 border-y border-solid border-hairline bg-sunken"
        >
          <div className="page-container py-16 md:py-24">
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
              <div>
                <p className="t-label text-muted">Inside the plan</p>
                <h2 className="t-title mt-2 text-ink">One page. Every detail in place.</h2>
              </div>
              <p className="t-data-sm text-muted">
                Sample trip · London, Ontario · 4 days
              </p>
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <ProductShot
                src="/landing/route-detail.webp"
                alt="A day in the PlanMyTrip.health route: four day tabs, a numbered London map with ten places, travel distance and time, and the ordered stops for day one."
                width={1200}
                height={1245}
                sizes="(min-width: 1024px) 42vw, 100vw"
                caption="A route that fits the day · numbered stops, chosen transport, Google Maps handoff."
              />

              <div className="flex flex-col gap-8">
                <ProductShot
                  src="/landing/safety-envelope.webp"
                  alt="The PlanMyTrip.health safety envelope: a health safety score of 72 out of 100, a daily step ceiling of 7,000, and a modeled flare risk reduction of 59 percent."
                  width={1200}
                  height={648}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  caption="The safety envelope · modeled ceilings, recovery, and a checkpoint for every day."
                />

                <div className="border-t border-solid border-hairline-strong pt-4">
                  <h3 className="t-label text-muted">Also in every plan</h3>
                  <dl className="mt-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-solid border-hairline py-2">
                      <dt className="t-data-sm text-ink">Saved trips</dt>
                      <dd className="t-data-sm text-muted">
                        Account-owned snapshots, ready to reopen.
                      </dd>
                    </div>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-solid border-hairline py-2">
                      <dt className="t-data-sm text-ink">Care card</dt>
                      <dd className="t-data-sm text-muted">
                        Plain text for a clinician and an insurer.
                      </dd>
                    </div>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                      <dt className="t-data-sm text-ink">Live sources</dt>
                      <dd className="t-data-sm text-muted">
                        A URL and checked time with every fact.
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="page-container py-16 md:py-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
            <div>
              <p className="t-label text-muted">Safety first</p>
              <h2 className="t-title mt-2 text-ink">Every day has a ceiling.</h2>
              <p className="t-body measure mt-4 text-muted">
                Five condition profiles map to a step ceiling, a walking ceiling, required
                recovery, and a modeled score. Day one is paced at 45% of the ceiling, middle
                days at 80%, and the final day at 40%. A live check can only tighten the
                envelope, never widen it.
              </p>
            </div>
            <dl className="grid grid-cols-1 gap-0 border-t border-solid border-hairline-strong sm:grid-cols-2">
              <div className="border-b border-solid border-hairline py-3 sm:pr-6">
                <dt className="t-label text-muted">Daily step ceiling</dt>
                <dd className="t-data mt-1 text-ink">
                  A hard limit from the condition profile
                </dd>
              </div>
              <div className="border-b border-solid border-hairline py-3 sm:pl-6">
                <dt className="t-label text-muted">Walking ceiling</dt>
                <dd className="t-data mt-1 text-ink">
                  Measured in kilometres, not optimistic steps
                </dd>
              </div>
              <div className="border-b border-solid border-hairline py-3 sm:pr-6">
                <dt className="t-label text-muted">Recovery</dt>
                <dd className="t-data mt-1 text-ink">
                  A required block, not a suggestion
                </dd>
              </div>
              <div className="border-b border-solid border-hairline py-3 sm:pl-6">
                <dt className="t-label text-muted">Checkpoint</dt>
                <dd className="t-data mt-1 text-ink">
                  What to watch, every day of the trip
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="border-y border-solid border-hairline bg-sunken">
          <div className="page-container py-16 md:py-24">
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
              <div>
                <p className="t-label text-muted">How it works</p>
                <h2 className="t-title mt-2 text-ink">One plan, three moves.</h2>
              </div>
              <p className="t-data-sm text-muted">
                From a blank page to a plan you can hold.
              </p>
            </div>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {STEPS.map((step) => (
                <div
                  key={step.number}
                  className="border-t border-solid border-hairline-strong pt-4"
                >
                  <p className="t-data text-accent">{step.number}</p>
                  <h3 className="t-heading mt-2 text-ink">{step.title}</h3>
                  <p className="t-small measure mt-1 text-muted">{step.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="page-container py-16 md:py-16">
          <div className="grid gap-10 border-t border-solid border-ink pt-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <div>
              <p className="t-label text-muted">Ready when you are</p>
              <h2 className="t-title mt-2 max-w-[18ch] text-ink">
                Plan the trip you can actually take.
              </h2>
              <p className="t-body measure mt-4 text-muted">
                Start with where you want to go. The engine and the team handle the rest.
                Save the plan, share the care card, and travel inside the ceiling.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <LinkButton variant="primary" href="/sign-up" external={false}>
                  Plan a trip
                </LinkButton>
                <LinkButton variant="secondary" href="/pricing" external={false}>
                  See plans
                </LinkButton>
              </div>
            </div>
            <LogoMark size={112} className="hidden text-hairline md:block" />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
