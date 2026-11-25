/**
 * The public landing page.
 *
 * Inputs: no data; the page reads as a server component and renders real product captures.
 * Outputs: the consumer positioning, the five health profiles, the product pillars, the
 * plan contents, the modeled safety envelope, how it works, and the account CTA.
 * Invariants: every screenshot is a real capture of this app with sample data and is only
 * cropped, never staged; every claim matches the shipped product; modeled figures keep their
 * label; the planning-aid notice stays in the site footer.
 */

import { LinkButton } from "@/components/ui";
import { LogoMark } from "@/components/Logo";
import { DestinationAd } from "@/components/ads/DestinationAd";
import { ProductShot } from "@/components/landing/ProductShot";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

const PROFILES = [
  {
    name: "Everyday relaxation",
    copy:
      "A gentle default pace for a trip that is meant to restore you, not wear you out.",
  },
  {
    name: "Breathing and asthma",
    copy:
      "The plan paces walking and recovery around air quality, altitude, and a clear step ceiling.",
  },
  {
    name: "Fatigue and POTS",
    copy: "Shorter blocks and longer recovery, so the day ends before your energy does.",
  },
  {
    name: "Second-trimester pregnancy",
    copy: "Rest, heat, and food safety are built into each day, not left to a checklist.",
  },
  {
    name: "Food allergy",
    copy:
      "Menus are checked live where possible, so you can read the kitchen's own notes.",
  },
  {
    name: "Heart health and blood pressure",
    copy:
      "Moderate days, midday recovery, and altitude limits are set before the route is built.",
  },
] as const;

const PILLARS = [
  {
    number: "01",
    title: "A pace that holds.",
    copy:
      "Daily step and walking ceilings shape the day. Recovery is scheduled, not squeezed in at the end.",
  },
  {
    number: "02",
    title: "A route that fits the day.",
    copy:
      "Stops are ordered by distance, transport matches the day, and every route hands off to Google Maps.",
  },
  {
    number: "03",
    title: "Places checked live.",
    copy:
      "Menus and room rates are read from the real page. Every fact keeps its source and checked time.",
  },
] as const;

const PLAN_CONTENTS = [
  {
    term: "Day-by-day plan",
    detail: "A paced itinerary with a reason behind each block.",
  },
  {
    term: "Numbered map",
    detail: "Every stop in order, with one route line per day.",
  },
  {
    term: "Safety envelope",
    detail: "Step and walking ceilings, recovery, and a daily checkpoint.",
  },
  {
    term: "Live venue evidence",
    detail: "Checked menus and room rates with source and checked time.",
  },
  {
    term: "Care card",
    detail: "A plain-text summary of the plan and its daily checkpoints.",
  },
  {
    term: "Saved trips",
    detail: "Reopen the plan from your account whenever you need it.",
  },
] as const;

const SAFETY_ROWS = [
  {
    term: "Daily step ceiling",
    detail: "A firm cap that comes from your health profile.",
  },
  {
    term: "Walking ceiling",
    detail: "Measured in kilometres, not optimistic step counts.",
  },
  {
    term: "Recovery",
    detail: "A scheduled block, not an optional extra.",
  },
  {
    term: "Checkpoint",
    detail: "What to notice on each day of the trip.",
  },
] as const;

const SAFETY_SAMPLE = [
  {
    label: "Pacing score",
    value: "72",
    unit: "/100",
    note: "Modeled estimate",
  },
  {
    label: "Daily step ceiling",
    value: "7,000",
    unit: "steps",
    note: "For the sample profile",
  },
  {
    label: "Modeled risk reduction",
    value: "59",
    unit: "%",
    note: "Versus a standard sightseeing day",
  },
] as const;

const STEPS = [
  {
    number: "01",
    title: "Tell us the trip and your health profile.",
    copy:
      "Destination, dates, budget, and how you get around. Then the health details that shape each day.",
  },
  {
    number: "02",
    title: "The team researches and paces it.",
    copy:
      "Specialists find places and check the live pages. The engine sets each day's ceiling, and the plan is sequenced inside it.",
  },
  {
    number: "03",
    title: "Travel with the plan, map, and care card.",
    copy:
      "Open the day-by-day route, the numbered map, and the safety envelope. Save it and carry the care card.",
  },
] as const;

/** The public home page for signed-out visitors. */
export function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader publicView />

      <main>
        <section className="page-container pb-16 pt-12 md:pb-24 md:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div className="min-w-0">
              <p className="t-label text-muted">Health-aware trip planning</p>
              <h1 className="t-display mt-4 max-w-[14ch] text-ink">
                Travel well, on your own terms.
              </h1>
              <p className="t-body measure mt-6 text-muted">
                Tell us where you want to go and what your health needs from a day. You get a
                paced itinerary, a real route, live-checked places, and a clear safety envelope.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <LinkButton variant="primary" href="/sign-up" external={false}>
                  Plan my trip
                </LinkButton>
                <LinkButton variant="secondary" href="#how-it-works" external={false}>
                  How it works
                </LinkButton>
              </div>
              <p className="t-data-sm mt-6 text-muted">Account required · Safety is free</p>
            </div>

            <div className="min-w-0">
              <ProductShot
                src="/landing/route-detail.webp"
                alt="The PlanMyTrip.health route view: a numbered map of London with a dashed day route, modeled travel distance and time, and the ordered stops for the day."
                width={1200}
                height={1245}
                crop={{ aspect: "1200 / 915", position: "bottom" }}
                priority
                sizes="(min-width: 1024px) 54vw, 100vw"
                caption="The route · numbered stops, modeled travel time, and a Google Maps handoff."
              />
            </div>
          </div>
        </section>

        <section className="page-container pb-16 md:pb-24">
          <DestinationAd variant="poster" intent="plan" placement="landing" />
        </section>

        <section className="border-y border-solid border-hairline bg-sunken">
          <div className="page-container py-16 md:py-24">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end">
              <div>
                <p className="t-label text-muted">Who it&apos;s for</p>
                <h2 className="t-title mt-2 text-ink">Built for the way you travel.</h2>
              </div>
              <div className="lg:justify-self-end">
                <p className="t-heading measure text-ink">
                  Your health is part of the itinerary, not a disclaimer.
                </p>
                <p className="t-small measure mt-2 text-muted">
                  Choose the health profile that fits you. The plan changes its pace, recovery,
                  and checkpoints to match.
                </p>
              </div>
            </div>

            <ol className="mt-10 list-none border-t border-solid border-hairline-strong p-0">
              {PROFILES.map((profile, index) => (
                <li
                  key={profile.name}
                  className="grid gap-2 border-b border-solid border-hairline py-4 md:grid-cols-[2.5rem_minmax(0,0.5fr)_minmax(0,1fr)] md:items-baseline md:gap-6"
                >
                  <p className="t-data text-accent">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h3 className="t-heading text-ink">{profile.name}</h3>
                  <p className="t-small measure text-muted">{profile.copy}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="page-container py-16 md:py-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
            <div>
              <p className="t-label text-muted">What makes it different</p>
              <h2 className="t-title mt-2 text-ink">
                A plan with a pace, a route, and proof.
              </h2>
              <p className="t-body measure mt-4 text-muted">
                A list of places is not a day. This plan sets the pace, orders the route, and
                checks the pages you will use.
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
                <h2 className="t-title mt-2 text-ink">One page, from first day to last.</h2>
              </div>
              <p className="t-data-sm text-muted">
                Sample trip · London, Ontario · 4 days
              </p>
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-12">
              <ProductShot
                src="/landing/venue-detail.webp"
                alt="The PlanMyTrip.health venue checks view with a room rate and checked menu counts for four London places, each with its source and checked state."
                width={1200}
                height={1067}
                crop={{ aspect: "1200 / 827", position: "bottom" }}
                sizes="(min-width: 1024px) 54vw, 100vw"
                caption="Live page checks · a room rate and menus, each with its source · London, Ontario"
              />

              <div>
                <h3 className="t-label text-muted">What you get</h3>
                <dl className="mt-3 border-t border-solid border-hairline-strong">
                  {PLAN_CONTENTS.map((item) => (
                    <div
                      key={item.term}
                      className="border-b border-solid border-hairline py-3"
                    >
                      <dt className="t-data-sm text-ink">{item.term}</dt>
                      <dd className="t-small mt-1 text-muted">{item.detail}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </section>

        <section className="page-container py-16 md:py-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div>
              <p className="t-label text-muted">The safety envelope</p>
              <h2 className="t-title mt-2 text-ink">Every day has a ceiling.</h2>
              <p className="t-body measure mt-4 text-muted">
                Your health profile sets a daily step ceiling, a walking ceiling, and required
                recovery. The plan is built inside them.
              </p>
              <p className="t-data-sm mt-3 text-muted">
                Modeled estimate · pacing score and risk reduction
              </p>
            </div>
            <dl className="grid grid-cols-1 gap-0 border-t border-solid border-hairline-strong sm:grid-cols-2">
              {SAFETY_ROWS.map((row, index) => (
                <div
                  key={row.term}
                  className={`border-b border-solid border-hairline py-3 ${
                    index % 2 === 0 ? "sm:pr-6" : "sm:pl-6"
                  }`}
                >
                  <dt className="t-label text-muted">{row.term}</dt>
                  <dd className="t-data mt-1 text-ink">{row.detail}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-px border-y border-solid border-hairline-strong bg-hairline sm:grid-cols-3">
            {SAFETY_SAMPLE.map((metric) => (
              <div
                key={metric.label}
                className="bg-paper py-5 sm:px-5 sm:first:pl-0 sm:last:pr-0"
              >
                <p className="t-label text-muted">{metric.label}</p>
                <p className="mt-2 flex items-baseline gap-2">
                  <span className="t-metric text-ink">{metric.value}</span>
                  <span className="t-data text-muted">{metric.unit}</span>
                </p>
                <p className="t-data-sm mt-1 text-muted">{metric.note}</p>
              </div>
            ))}
          </div>
          <p className="t-data-sm mt-3 text-muted">
            Sample plan · London, Ontario · modeled values, not a measurement.
          </p>
        </section>

        <section
          id="how-it-works"
          className="scroll-mt-20 border-y border-solid border-hairline bg-sunken"
        >
          <div className="page-container py-16 md:py-24">
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
              <div>
                <p className="t-label text-muted">How it works</p>
                <h2 className="t-title mt-2 text-ink">
                  From a destination to a plan you can hold.
                </h2>
              </div>
              <p className="t-data-sm text-muted">
                A new live plan takes a few minutes. Repeat destinations open from cache.
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
              <h2 className="t-title mt-2 max-w-[20ch] text-ink">
                Start with a destination. We&apos;ll fit the days around you.
              </h2>
              <p className="t-body measure mt-4 text-muted">
                Build a paced plan, check the live pages, and carry the safety envelope and care
                card with you.
              </p>
              <p className="t-small mt-3 text-muted">
                Safety is free. Live checks and longer trips are in Care Circle.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <LinkButton variant="primary" href="/sign-up" external={false}>
                  Plan my trip
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
