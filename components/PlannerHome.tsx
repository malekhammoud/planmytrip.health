"use client";

import { useMemo, useState } from "react";
import { capture } from "@/lib/analytics";
import { Onboarding } from "@/components/Onboarding";
import { PlanWorkspace } from "@/components/PlanWorkspace";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { rememberAdDestination } from "@/lib/ads/destinationMemory";
import { buildHealthTripPlan, type HealthTripPlan } from "@/lib/healthTripEngine";
import type { TripConfig } from "@/lib/agent/agentTypes";
import type { BillingEntitlements } from "@/lib/billing/plans";
import { DEFAULT_TRIP, type TripDraft } from "@/lib/onboarding";
import { parseInstallId } from "@/lib/data/validation";

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
 * the workspace is a live command surface that keeps both agent teams mounted while
 * the traveler moves through it. Editing returns to onboarding without discarding a
 * running workspace, so Back to plan restores it exactly.
 */
export function PlannerHome({
  entitlements,
  initialDestination = "",
}: {
  entitlements: BillingEntitlements;
  /** Destination carried in from a house-ad link, before the first build. */
  initialDestination?: string;
}) {
  const [view, setView] = useState<"onboarding" | "workspace">("onboarding");
  const [trip, setTrip] = useState<TripConfig | null>(null);
  const [deployNonce, setDeployNonce] = useState(0);
  const [installId] = useState(readInstallId);
  const [runId, setRunId] = useState("");
  const initialDraft = useMemo<TripDraft>(
    () => ({ ...DEFAULT_TRIP, destination: initialDestination }),
    [initialDestination],
  );

  const plan = useMemo<HealthTripPlan | null>(() => {
    if (trip === null) return null;
    return buildHealthTripPlan({
      destination: trip.destination,
      days: trip.days,
      condition: trip.condition,
    });
  }, [trip]);

  function handleBuild(config: TripConfig): void {
    capture("plan_build_started", { page: window.location.pathname });
    rememberAdDestination(config.destination);
    setTrip(config);
    setRunId(crypto.randomUUID());
    setDeployNonce((nonce) => nonce + 1);
    setView("workspace");
  }

  function handleReplan(): void {
    capture("plan_rebuild_started", { page: window.location.pathname });
    setRunId(crypto.randomUUID());
    setDeployNonce((nonce) => nonce + 1);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <div className="flex-1">
        <div id="onboarding-screen" hidden={view !== "onboarding"}>
          <Onboarding
            initial={trip ?? initialDraft}
            entitlements={entitlements}
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
              entitlements={entitlements}
              visible={view === "workspace"}
              onEditTrip={() => setView("onboarding")}
              onReplan={handleReplan}
            />
          </div>
        ) : null}
      </div>

      <SiteFooter adDestination={trip?.destination} />
    </div>
  );
}
