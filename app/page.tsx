"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Onboarding } from "@/components/Onboarding";
import { PlanWorkspace } from "@/components/PlanWorkspace";
import { buildHealthTripPlan, type HealthTripPlan } from "@/lib/healthTripEngine";
import type { TripConfig } from "@/lib/agent/agentTypes";
import { DEFAULT_TRIP } from "@/lib/onboarding";
import { parseInstallId } from "@/lib/data/validation";

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
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/model"
            className="t-small inline-flex min-h-11 items-center text-muted transition-colors duration-150 hover:text-ink hover:underline"
          >
            Model card
          </Link>
          <SisterProductLink className="flex sm:hidden" />
        </div>
      </div>
    </footer>
  );
}

/**
 * Reads or creates the anonymous install id. The lazy state initializer keeps this out
 * of an effect; the value is never rendered, so server and client markup stay identical.
 */
function readInstallId(): string {
  if (typeof window === "undefined") return "";
  const key = "planmytrip.installId";
  try {
    const existing = parseInstallId(window.localStorage.getItem(key));
    if (existing !== null) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    // Private browsing or a blocked storage partition: still return an id for this
    // session, but do not claim it will survive a reload.
    return crypto.randomUUID();
  }
}

/**
 * Two screens, one client session. Onboarding collects the trip and health profile;
 * the workspace keeps both agent teams mounted while the user moves between Plan,
 * Pacing, Verification, and Team. Editing returns to onboarding without discarding a
 * running workspace, so Back to plan restores it exactly.
 */
export default function Home() {
  const [view, setView] = useState<"onboarding" | "workspace">("onboarding");
  const [trip, setTrip] = useState<TripConfig | null>(null);
  const [deployNonce, setDeployNonce] = useState(0);
  const [installId] = useState(readInstallId);
  const [runId, setRunId] = useState("");

  const plan = useMemo<HealthTripPlan | null>(() => {
    if (trip === null) return null;
    return buildHealthTripPlan({
      destination: trip.destination,
      days: trip.days,
      condition: trip.condition,
      medication: trip.medication,
      hasSunLifeTravelCoverage: trip.hasSunLifeTravelCoverage,
    });
  }, [trip]);

  function handleBuild(config: TripConfig): void {
    setTrip(config);
    setRunId(crypto.randomUUID());
    setDeployNonce((nonce) => nonce + 1);
    setView("workspace");
  }

  function handleReplan(): void {
    setRunId(crypto.randomUUID());
    setDeployNonce((nonce) => nonce + 1);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <div className="flex-1">
        <div id="onboarding-screen" hidden={view !== "onboarding"}>
          <Onboarding
            initial={trip ?? DEFAULT_TRIP}
            onComplete={handleBuild}
            onCancel={trip === null ? undefined : () => setView("workspace")}
          />
        </div>

        {trip !== null && plan !== null ? (
          <div id="workspace-screen" hidden={view !== "workspace"}>
            <PlanWorkspace
              key={deployNonce}
              trip={trip}
              plan={plan}
              runToken={deployNonce}
              runId={runId}
              installId={installId}
              visible={view === "workspace"}
              onEditTrip={() => setView("onboarding")}
              onReplan={handleReplan}
            />
          </div>
        ) : null}
      </div>

      <SiteFooter />
    </div>
  );
}
