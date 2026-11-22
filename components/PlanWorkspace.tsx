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
import { Callout, type CalloutTone } from "@/components/ui";
import { useAgentPlan } from "@/hooks/useAgentPlan";
import { useSwarm } from "@/hooks/useSwarm";
import { surfaceMode, missionStage } from "@/lib/agent/plannerStage";
import { isSwarmLive, swarmSummary } from "@/lib/swarmTelemetry";
import {
  applyVerification,
  type VerificationFindingInput,
} from "@/lib/verificationOverlay";
import { WORKER_IDS } from "@/lib/swarmTypes";
import type { HealthTripPlan, SunLifeSeverity } from "@/lib/healthTripEngine";
import type { TripConfig } from "@/lib/agent/agentTypes";

/** Props for {@link PlanWorkspace}. */
export interface PlanWorkspaceProps {
  trip: TripConfig;
  plan: HealthTripPlan;
  runToken: number;
  /** Opaque browser run id shared by both agent requests and the capture route. */
  runId: string;
  /** Anonymous install id scoped to this browser. */
  installId: string;
  /** False while onboarding covers the workspace; keeps the map sized correctly. */
  visible: boolean;
  onEditTrip: () => void;
  onReplan: () => void;
}

const ALERT_TONES: Record<SunLifeSeverity, CalloutTone> = {
  ok: "info",
  caution: "caution",
  blocking: "risk",
};

function count(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * The live command surface. One sticky instrument bar carries identity, stage, clocks,
 * and counts; below it a named-area grid reorders as real events land: the team leads
 * while sessions open, stage and team sit together as research arrives, the stage takes
 * the width while the concierge composes, and the finished stage leads with the team
 * compacted to a strip. Both agent streams and all three preview frames stay mounted
 * for the whole workspace, so nothing aborts when panels move.
 */
export function PlanWorkspace({
  trip,
  plan,
  runToken,
  runId,
  installId,
  visible,
  onEditTrip,
  onReplan,
}: PlanWorkspaceProps) {
  const { state, retry } = useAgentPlan({
    destination: trip.destination,
    origin: trip.origin,
    days: trip.days,
    condition: trip.condition,
    medication: trip.medication,
    interests: trip.interests,
    budget: trip.budget,
    transport: trip.transport,
    runId,
    installId,
    captureConsent: trip.captureConsent,
    hasSunLifeTravelCoverage: trip.hasSunLifeTravelCoverage,
    runToken,
  });

  const swarm = useSwarm({
    destination: trip.destination,
    condition: trip.condition,
    medication: trip.medication,
    runId,
    installId,
    captureConsent: trip.captureConsent,
    runToken,
  });

  const [adjustmentMaster, setAdjustmentMaster] = useState(true);
  const [disabledAdjustments, setDisabledAdjustments] = useState<readonly string[]>([]);
  const [activeDay, setActiveDay] = useState<number | null>(null);
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
  const stage = missionStage(state);
  const mode = surfaceMode(stage);
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
          ? `${completed}/7 in · concierge composing`
          : stage === "researching"
            ? `${completed}/7 in · route forming`
            : "Sessions opening";

  // Only the surface carrying the live work opens by default. The route stage leads
  // while composing; verification takes over while checks run; the route returns when
  // checks settle. The safety envelope is static reference, so it stays folded until
  // the reader opens it.
  const routeActive = stage === "ready" && !checksLive;
  const teamActive =
    stage === "starting" || stage === "researching" || stage === "composing";
  const checksActive = checksLive;
  const railActive = state.status === "running" || checksLive;

  // A new build or replan remounts the workspace; open it at the top, not at the
  // onboarding submit button's scroll offset. Edit trip keeps the position untouched.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [runToken]);

  // The first plan_ready focuses day one, so the map, route, and day plan open together.
  const seenPlanRef = useRef(state.plan);
  useEffect(() => {
    if (state.plan === null) {
      seenPlanRef.current = null;
      return;
    }
    if (seenPlanRef.current !== state.plan) {
      seenPlanRef.current = state.plan;
      setActiveDay(state.plan.days[0]?.day ?? null);
    }
  }, [state.plan]);

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

  return (
    <main>
      <CommandBar
        trip={trip}
        runId={runId}
        plan={state.plan}
        state={state}
        swarm={swarm.state}
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
            id="route-stage"
            title="Route and days"
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
            />
          </WorkspaceSection>

          <WorkspaceSection
            id="planning-team"
            title="Planning team"
            summary={`${completed} of 7 complete${incompleteCount > 0 ? ` · ${incompleteCount} incomplete` : ""}`}
            active={teamActive}
            className={`cg-deck ${pulse}`}
          >
            <AgentTeamPanel state={state} compact={stage === "ready"} stage={stage} />
          </WorkspaceSection>

          <WorkspaceSection
            id="live-verification"
            title="Live verification"
            summary={
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`block h-1.5 w-1.5 ${
                    checksLive ? "anim-pulse-dot bg-accent" : "bg-ink"
                  }`}
                />
                {verification.running} running · {verification.steps} steps ·{" "}
                {verification.sources} sources · {verification.findings}/3 findings
              </span>
            }
            active={checksActive}
            className={`cg-verify ${pulse}`}
          >
            <MissionControl
              state={swarm.state}
              runInput={swarm.runInput}
              destination={trip.destination}
              condition={trip.condition}
              medication={trip.medication}
              onRetry={swarm.retry}
              onRerun={swarm.rerun}
              expanded={stage === "ready"}
            />
          </WorkspaceSection>

          <WorkspaceSection
            id="safety-envelope"
            title="Safety envelope"
            summary={`${plan.itinerary.length} days · ${count(plan.dailyStepCeiling)} steps/day · ${walkingCap.toFixed(1)} km walking/day${applied > 0 ? ` · ${applied} adjustments` : ""}`}
            active={false}
            className={`cg-env ${pulse}`}
          >
            <div className="mb-4">
              <CareCardButton
                destination={trip.destination}
                condition={trip.condition}
                medication={trip.medication}
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
            <div className="mt-4">
              <Callout
                tone={ALERT_TONES[plan.sunLifeAlert.severity]}
                title={plan.sunLifeAlert.title}
              >
                <div className="flex flex-col gap-1">
                  {plan.sunLifeAlert.messages.map((message) => (
                    <p key={message}>{message}</p>
                  ))}
                </div>
              </Callout>
            </div>
            <div className="mt-6">
              <ItineraryBoard
                plan={overlay.plan}
                destination={trip.destination}
                condition={trip.condition}
                medication={trip.medication}
                adjustments={overlay.adjustments}
                verification={{ checked: verification.findings, total: 3 }}
                activeDay={activeDay}
                onSelectDay={setActiveDay}
              />
            </div>
          </WorkspaceSection>

          <WorkspaceSection
            id="live-activity"
            title="Live activity"
            summary={railActive ? "Streaming" : "Settled"}
            active={railActive}
            className="cg-rail"
          >
            <LiveRail state={state} swarm={swarm.state} />
          </WorkspaceSection>
        </div>
      </div>

      <CommandDock plannerLive={state.status === "running"} checksLive={checksLive} />
    </main>
  );
}
