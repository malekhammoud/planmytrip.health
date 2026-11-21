"use client";

import { useEffect, useMemo, useState } from "react";
import { AgentPlanner } from "@/components/AgentPlanner";
import { AgentSwarmMonitor } from "@/components/AgentSwarmMonitor";
import { ConstraintSidebar } from "@/components/ConstraintSidebar";
import { CareCardButton, ItineraryBoard } from "@/components/ItineraryBoard";
import { SectionHeader } from "@/components/ui";
import type { BudgetLevel } from "@/lib/agent/agentTypes";
import { describeTrip } from "@/lib/describeTrip";
import {
  buildHealthTripPlan,
  checkSunLifeCoverage,
  DEFAULT_MEDICATION_BY_CONDITION,
  type HealthTripPlan,
} from "@/lib/healthTripEngine";
import type { Condition } from "@/lib/types";

const SISTER_PRODUCT_URL = "https://ismytripsafe.com";

/**
 * The sister-product link. It is plain text, lives in the header from 640px up,
 * and moves to the footer below that. The 44px minimum height keeps the tap
 * target comfortable without turning the link into a pill.
 */
function SisterProductLink({ className }: { className: string }) {
  return (
    <a
      href={SISTER_PRODUCT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`t-small min-h-11 items-center text-muted transition-colors duration-150 hover:text-ink hover:underline ${className}`}
    >
      Sister product to IsMyTripSafe.com
    </a>
  );
}

/** Sticky 64px letterhead: wordmark left, sister-product link right from 640px. */
function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 h-16 border-b border-hairline bg-paper">
      <div className="page-container flex h-full items-center justify-between gap-6">
        <p className="t-wordmark text-ink">
          PlanMyTrip
          <span className="t-data text-accent">.health</span>
        </p>
        <SisterProductLink className="hidden sm:inline-flex" />
      </div>
    </header>
  );
}

/**
 * Closing notice. Below 640px the sister-product link lives here; from 640px up
 * the header carries it instead. The 96px desktop / 64px mobile top margin is the
 * section gap above the footer.
 */
function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-hairline md:mt-24">
      <div className="page-container flex flex-col gap-3 py-6 sm:flex-row sm:items-baseline sm:justify-between">
        <p className="t-small measure text-muted">
          Planning aid only. Not medical advice. Confirm with your clinician and insurer
          before you travel.
        </p>
        <SisterProductLink className="flex sm:hidden" />
      </div>
    </footer>
  );
}

/**
 * PlanMyTrip.health home page. It owns every planner input and composes the rail,
 * the headline, and the two result sections. The engine runs only when a
 * destination is present; the Sun Life alert is always derived so the rail stays
 * live while the destination field is empty.
 */
export default function Home() {
  const [destination, setDestination] = useState("Tokyo, Japan");
  const [days, setDays] = useState(4);
  const [condition, setCondition] = useState<Condition>("asthma_respiratory");
  const [medication, setMedication] = useState(
    DEFAULT_MEDICATION_BY_CONDITION.asthma_respiratory,
  );
  const [medicationTouched, setMedicationTouched] = useState(false);
  const [interests, setInterests] = useState("");
  const [budget, setBudget] = useState<BudgetLevel>("balanced");
  const [hasSunLifeTravelCoverage, setHasSunLifeTravelCoverage] = useState(false);
  const [deployNonce, setDeployNonce] = useState(0);
  const [railOpen, setRailOpen] = useState(true);

  // A closed mobile panel must not hide the rail after a resize to desktop,
  // where its summary is hidden. Force it open whenever 1024px is matched.
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      if (media.matches) setRailOpen(true);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const plan = useMemo<HealthTripPlan | null>(() => {
    if (destination.trim().length === 0) return null;
    return buildHealthTripPlan({
      destination,
      days,
      condition,
      medication,
      hasSunLifeTravelCoverage,
    });
  }, [destination, days, condition, medication, hasSunLifeTravelCoverage]);

  const sunLifeAlert = useMemo(
    () =>
      plan ? plan.sunLifeAlert : checkSunLifeCoverage(days, hasSunLifeTravelCoverage),
    [plan, days, hasSunLifeTravelCoverage],
  );

  const headline = describeTrip({ destination, days, condition });

  /**
   * A condition change seeds the generic medication name only while the user has
   * not edited the field. Once touched, the typed value survives every change.
   */
  function handleConditionChange(next: Condition) {
    setCondition(next);
    if (!medicationTouched) {
      setMedication(DEFAULT_MEDICATION_BY_CONDITION[next]);
    }
  }

  function handleMedicationChange(next: string) {
    setMedication(next);
    setMedicationTouched(true);
  }

  function handleDeploy() {
    setDeployNonce((nonce) => nonce + 1);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="flex-1">
        <div className="page-container pt-16 md:pt-24 lg:pt-6">
          <div className="lg:grid lg:grid-cols-[320px_1px_minmax(0,1fr)] lg:gap-16">
            <aside className="mb-16 border-b border-hairline pb-10 md:mb-24 lg:sticky lg:top-[88px] lg:mb-0 lg:max-h-[calc(100vh_-_112px)] lg:self-start lg:overflow-y-auto lg:border-b-0 lg:px-1 lg:pb-0">
              <details
                open={railOpen}
                onToggle={(event) => setRailOpen(event.currentTarget.open)}
              >
                <summary className="mb-6 min-h-11 cursor-pointer break-words t-body text-ink [overflow-wrap:anywhere] lg:hidden">
                  {headline}
                </summary>
                <div className="lg:block">
                  {/* The rail owns no state; page state flows in and changes flow out. */}
                  <ConstraintSidebar
                    destination={destination}
                    days={days}
                    condition={condition}
                    medication={medication}
                    interests={interests}
                    budget={budget}
                    hasSunLifeTravelCoverage={hasSunLifeTravelCoverage}
                    sunLifeAlert={sunLifeAlert}
                    onDestinationChange={setDestination}
                    onDaysChange={setDays}
                    onConditionChange={handleConditionChange}
                    onMedicationChange={handleMedicationChange}
                    onInterestsChange={setInterests}
                    onBudgetChange={setBudget}
                    onCoverageChange={setHasSunLifeTravelCoverage}
                    onDeploy={handleDeploy}
                  />
                </div>
              </details>
            </aside>

            <div aria-hidden="true" className="hidden bg-hairline lg:block" />

            <div className="min-w-0">
              <h1 className="t-display measure break-words">{headline}</h1>
              <p className="t-body mt-6 text-muted">
                Conservative planning limits. Not medical advice.
              </p>

              <section aria-labelledby="concierge-heading">
                <SectionHeader
                  id="concierge-heading"
                  index="01"
                  title="Concierge"
                />
                <p className="t-body measure mb-6 text-muted">
                  A specialist team researches the trip. The lead concierge sequences
                  verified stays, tables, trails, transit, and care into a paced route.
                </p>
                <AgentPlanner
                  destination={destination}
                  days={days}
                  condition={condition}
                  medication={medication}
                  interests={interests}
                  budget={budget}
                  runToken={deployNonce}
                  onReplan={handleDeploy}
                />
              </section>

              <section aria-labelledby="pacing-heading">
                <SectionHeader
                  id="pacing-heading"
                  index="02"
                  title="Pacing"
                  action={
                    plan === null ? undefined : (
                      <CareCardButton
                        destination={destination}
                        condition={condition}
                        medication={medication}
                        plan={plan}
                      />
                    )
                  }
                />
                {plan === null ? (
                  <p className="t-small text-muted">
                    Add a destination to build a paced itinerary.
                  </p>
                ) : (
                  <ItineraryBoard
                    plan={plan}
                    destination={destination}
                    condition={condition}
                    medication={medication}
                  />
                )}
              </section>

              <section aria-labelledby="verification-heading">
                <SectionHeader
                  id="verification-heading"
                  index="03"
                  title="Verification"
                />
                <div id="agent-swarm-mount">
                  <AgentSwarmMonitor
                    destination={destination}
                    condition={condition}
                    medication={medication}
                    runToken={deployNonce}
                  />
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
