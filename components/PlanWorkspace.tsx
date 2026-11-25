"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AgentTeamPanel } from "@/components/AgentTeamPanel";
import { CommandBar } from "@/components/CommandBar";
import { CommandDock } from "@/components/CommandDock";
import { CareCardButton, ItineraryBoard } from "@/components/ItineraryBoard";
import { LiveRail } from "@/components/LiveRail";
import { MissionControl } from "@/components/mission/MissionControl";
import { PlanPanel } from "@/components/PlanPanel";
import { AdjustmentsPanel } from "@/components/VerificationAdjustments";
import { WorkspaceSection } from "@/components/WorkspaceSection";
import { UpgradeCallout } from "@/components/UpgradeCallout";
import { VenueMissionControl } from "@/components/venue/VenueMissionControl";
import { useAgentPlan } from "@/hooks/useAgentPlan";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useSwarm } from "@/hooks/useSwarm";
import { useVenueResearch } from "@/hooks/useVenueResearch";
import { PLANNER_AGENT_IDS } from "@/lib/agent/agentTypes";
import { surfaceMode, missionStage } from "@/lib/agent/plannerStage";
import { isSwarmLive, swarmSummary } from "@/lib/swarmTelemetry";
import {
  applyVerification,
  type VerificationFindingInput,
} from "@/lib/verificationOverlay";
import { WORKER_IDS } from "@/lib/swarmTypes";
import type { HealthTripPlan } from "@/lib/healthTripEngine";
import type { TripConfig } from "@/lib/agent/agentTypes";
import type { BillingEntitlements } from "@/lib/billing/plans";
import type { VenueResearchState } from "@/lib/venue/venueState";

/** Props for {@link PlanWorkspace}. */
export interface PlanWorkspaceProps {
  trip: TripConfig;
  plan: HealthTripPlan;
  runToken: number;
  /** Opaque browser run id shared by both agent requests and the capture route. */
  runId: string;
  /** Anonymous install id scoped to this browser. */
  installId: string;
  /** Current plan limits and paid feature flags. */
  entitlements: BillingEntitlements;
  /** False while onboarding covers the workspace; keeps the map sized correctly. */
  visible: boolean;
  onEditTrip: () => void;
  onReplan: () => void;
}

function count(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function venueSummaryText(
  enabled: boolean,
  ready: boolean,
  state: VenueResearchState,
): string {
  if (!enabled) return "Included in Care Circle";
  if (!ready) return "Opens when the plan is ready";
  const pages = state.order.length;
  if (pages === 0) {
    return state.status === "running" ? "Resolving pages" : "No pages attached";
  }
  let checked = 0;
  let menus = 0;
  let hotels = 0;
  for (const id of state.order) {
    const worker = state.workers[id];
    if (worker === undefined) continue;
    if (worker.phase === "complete" || worker.phase === "error") checked += 1;
    if (worker.evidence?.kind === "menu") menus += 1;
    if (worker.evidence?.kind === "hotel") hotels += 1;
  }
  const parts = [`${checked} of ${pages} pages checked`];
  if (menus > 0) parts.push(`${menus} ${menus === 1 ? "menu" : "menus"}`);
  if (hotels > 0) {
    parts.push(`${hotels} ${hotels === 1 ? "room quote" : "room quotes"}`);
  }
  return parts.join(" · ");
}

function destinationSummary(
  enabled: boolean,
  live: boolean,
  completed: number,
  failed: number,
  findings: number,
): string {
  if (!enabled) return "Included in Care Circle";
  if (live) return "Checking the destination";
  if (completed + failed === 0) return "Ready when the plan is";
  if (WORKER_IDS.length === 1) {
    return findings === 1 ? "1 source checked" : "Source not available";
  }
  return `${findings} of ${WORKER_IDS.length} sources checked`;
}

/**
 * The live command surface. One sticky instrument bar carries identity, stage, clocks,
 * specialist progress, and actions; below it a named-area grid reorders as real events
 * land. Both agent streams and every live page view stay mounted for the whole
 * workspace, so nothing aborts when panels move.
 */
export function PlanWorkspace({
  trip,
  plan,
  runToken,
  runId,
  installId,
  entitlements,
  visible,
  onEditTrip,
  onReplan,
}: PlanWorkspaceProps) {
  const { state, retry } = useAgentPlan({
    destination: trip.destination,
    origin: trip.origin,
    days: trip.days,
    condition: trip.condition,
    interests: trip.interests,
    budget: trip.budget,
    transport: trip.transport,
    checkIn: trip.checkIn,
    travelers: trip.travelers,
    runId,
    installId,
    captureConsent: trip.captureConsent,
    runToken,
  });

  const venue = useVenueResearch({
    plan: state.plan,
    destination: trip.destination,
    checkIn: trip.checkIn,
    days: trip.days,
    travelers: trip.travelers,
    enabled: state.plan !== null && entitlements.venueResearch,
  });

  const swarm = useSwarm({
    destination: trip.destination,
    condition: trip.condition,
    runId,
    installId,
    captureConsent: trip.captureConsent,
    enabled: entitlements.liveVerification,
    runToken,
  });

  const reduced = useReducedMotion();
  const [adjustmentMaster, setAdjustmentMaster] = useState(true);
  const [disabledAdjustments, setDisabledAdjustments] = useState<readonly string[]>([]);
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [venueRequest, setVenueRequest] = useState(0);
  const verificationFindings = useMemo<VerificationFindingInput[]>(
    () =>
      WORKER_IDS.flatMap((worker) => {
        const value = swarm.state.workers[worker];
        if (value.findings === null) return [];
        return [
          {
            worker,
            findings: value.findings,
            sourceUrl: value.sourceUrl ?? "",
            retrievedAt: value.retrievedAt ?? "",
          },
        ];
      }),
    [swarm.state.workers],
  );
  const overlay = useMemo(
    () =>
      applyVerification(
        plan,
        { condition: trip.condition },
        verificationFindings,
        { master: adjustmentMaster, disabledIds: disabledAdjustments },
      ),
    [plan, trip.condition, verificationFindings, adjustmentMaster, disabledAdjustments],
  );
  const verification = swarmSummary(swarm.state);
  const checksLive = isSwarmLive(swarm.state);
  const venueLive = venue.state.status === "running";
  const stage = missionStage(state);
  const mode = surfaceMode(stage);
  const specialistTotal = PLANNER_AGENT_IDS.length;
  const completed = Object.values(state.agents).filter(
    (agent) => agent.phase === "complete",
  ).length;
  const incompleteCount = Object.values(state.agents).filter(
    (agent) => agent.phase === "error",
  ).length;
  const applied = overlay.adjustments.filter((adjustment) => adjustment.applied).length;
  const walkingCap = Math.max(
    ...plan.itinerary.map((day) => day.walkingCapKm),
    0,
  );

  const routeMeta =
    state.plan !== null
      ? `${state.plan.days.length} days · plan ready`
      : stage === "error"
        ? "Planning paused"
        : stage === "composing"
          ? `${completed}/${specialistTotal} in · concierge composing`
          : stage === "researching"
            ? `${completed}/${specialistTotal} in · route forming`
            : "Sessions opening";

  // Only the surface carrying the live work opens by default. The route stage leads
  // while composing; the destination check takes over while it runs; the route returns
  // when checks settle. The safety envelope opens with the finished plan, and checked
  // places open while those pages run or when the plan summary asks for them.
  const routeActive = stage === "ready" && !checksLive;
  const teamActive =
    stage === "starting" || stage === "researching" || stage === "composing";
  const checksActive = checksLive;
  const safetyActive = stage === "ready";
  const railActive = state.status === "running" || checksLive;

  // A new build or replan remounts the workspace; open it at the top, not at the
  // onboarding submit button's scroll offset. Edit trip keeps the position untouched.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [runToken]);

  // The finished plan starts with all days visible; the reader can focus one day from
  // the map, route, or envelope without a second itinerary opening first. The workspace
  // remounts on a new build, so null stays the default for every run.

  // A layout reorder fades the moved panels once; the class toggle never remounts them.
  const [reorderPulse, setReorderPulse] = useState(false);
  const layoutKey = `${mode}:${checksLive ? "live" : "settled"}`;
  const previousModeRef = useRef(layoutKey);
  useEffect(() => {
    if (previousModeRef.current === layoutKey) return;
    previousModeRef.current = layoutKey;
    setReorderPulse(true);
    const timer = window.setTimeout(() => setReorderPulse(false), 300);
    return () => window.clearTimeout(timer);
  }, [layoutKey]);
  const pulse = reorderPulse ? "anim-fade" : "";

  const toggleAdjustment = (id: string, enabled: boolean): void => {
    setDisabledAdjustments((current) =>
      enabled
        ? current.filter((entry) => entry !== id)
        : [...new Set([...current, id])],
    );
  };

  const openVenueChecks = (): void => {
    setVenueRequest((current) => current + 1);
    window.setTimeout(() => {
      document.getElementById("venue-deck-heading")?.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "start",
      });
    }, 60);
  };

  return (
    <main>
      <CommandBar
        trip={trip}
        runId={runId}
        plan={state.plan}
        state={state}
        swarm={swarm.state}
        entitlements={entitlements}
        onEditTrip={onEditTrip}
        onReplan={onReplan}
      />

      <div className="page-container pb-32 pt-8 md:pt-10 lg:pb-24">
        <div
          className={`command-grid command-grid--${mode}`}
          data-mode={mode}
          data-checks={checksLive ? "live" : "settled"}
        >
          <WorkspaceSection
            id="trip-route"
            title="Your route"
            summary={routeMeta}
            active={routeActive}
            className="cg-stage"
          >
            <PlanPanel
              state={state}
              visible={visible}
              days={trip.days}
              stage={stage}
              origin={trip.origin}
              transport={trip.transport}
              capture={{ runId, installId, consent: trip.captureConsent }}
              onRetry={retry}
              activeDay={activeDay}
              onSelectDay={setActiveDay}
              venueEvidence={venue.evidence}
              onViewChecks={openVenueChecks}
            />
          </WorkspaceSection>

          <WorkspaceSection
            id="research-team"
            title="Research team"
            summary={`${completed} of ${specialistTotal} complete${incompleteCount > 0 ? ` · ${incompleteCount} incomplete` : ""}`}
            active={teamActive}
            className={`cg-deck ${pulse}`}
          >
            <AgentTeamPanel state={state} compact={stage === "ready"} stage={stage} />
          </WorkspaceSection>

          <WorkspaceSection
            id="destination-check"
            title="Destination check"
            summary={
              entitlements.liveVerification ? (
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`block h-1.5 w-1.5 ${
                      checksLive ? "anim-pulse-dot bg-accent" : "bg-ink"
                    }`}
                  />
                  {destinationSummary(
                    true,
                    checksLive,
                    verification.completed,
                    verification.failed,
                    verification.findings,
                  )}
                </span>
              ) : (
                "Included in Care Circle"
              )
            }
            active={checksActive}
            className={`cg-verify ${pulse}`}
          >
            {entitlements.liveVerification ? (
              <MissionControl
                state={swarm.state}
                runInput={swarm.runInput}
                destination={trip.destination}
                condition={trip.condition}
                onRetry={swarm.retry}
                onRerun={swarm.rerun}
                expanded={stage === "ready"}
              />
            ) : (
              <UpgradeCallout feature="Live destination checks" />
            )}
          </WorkspaceSection>

          <WorkspaceSection
            id="checked-places"
            title="Checked places"
            summary={
              entitlements.venueResearch ? (
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`block h-1.5 w-1.5 ${
                      venueLive ? "anim-pulse-dot bg-accent" : "bg-ink"
                    }`}
                  />
                  {venueSummaryText(true, state.plan !== null, venue.state)}
                </span>
              ) : (
                "Included in Care Circle"
              )
            }
            active={venueLive}
            openRequest={venueRequest}
            className={`cg-venue ${pulse}`}
          >
            {entitlements.venueResearch ? (
              <VenueMissionControl
                state={venue.state}
                checkIn={trip.checkIn}
                onRetry={venue.retry}
                mock={state.mock}
              />
            ) : (
              <UpgradeCallout feature="Live menus and room rates" />
            )}
          </WorkspaceSection>

          <WorkspaceSection
            id="pacing-safety"
            title="Pacing and safety"
            summary={`${plan.itinerary.length} days · ${count(plan.dailyStepCeiling)} steps/day · ${walkingCap.toFixed(1)} km walking/day${applied > 0 ? ` · ${applied} adjustments` : ""}`}
            active={safetyActive}
            className={`cg-env ${pulse}`}
          >
            <div className="mb-4">
              <CareCardButton
                destination={trip.destination}
                condition={trip.condition}
                plan={overlay.plan}
                adjustments={overlay.adjustments}
              />
            </div>
            {verificationFindings.length > 0 ? (
              <AdjustmentsPanel
                adjustments={overlay.adjustments}
                master={adjustmentMaster}
                onMaster={setAdjustmentMaster}
                onToggle={toggleAdjustment}
              />
            ) : null}
            <div className="mt-6">
              <ItineraryBoard
                plan={overlay.plan}
                destination={trip.destination}
                condition={trip.condition}
                adjustments={overlay.adjustments}
                verification={{ checked: verification.findings, total: WORKER_IDS.length }}
                activeDay={activeDay}
                onSelectDay={setActiveDay}
              />
            </div>
          </WorkspaceSection>

          <WorkspaceSection
            id="activity"
            title="Activity"
            summary={railActive ? "Live" : "Settled"}
            active={railActive}
            className="cg-rail"
          >
            <LiveRail state={state} swarm={swarm.state} />
          </WorkspaceSection>
        </div>
      </div>

      <CommandDock
        plannerLive={state.status === "running"}
        checksLive={checksLive}
        venueLive={venueLive}
      />
    </main>
  );
}
