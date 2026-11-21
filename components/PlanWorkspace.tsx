"use client";

import { useState } from "react";
import { AgentSwarmMonitor } from "@/components/AgentSwarmMonitor";
import { AgentTeamPanel } from "@/components/AgentTeamPanel";
import { CareCardButton, ItineraryBoard } from "@/components/ItineraryBoard";
import { PlanPanel } from "@/components/PlanPanel";
import {
  Button,
  Callout,
  TabBar,
  type CalloutTone,
  type TabItem,
} from "@/components/ui";
import { useAgentPlan } from "@/hooks/useAgentPlan";
import type {
  HealthTripPlan,
  SunLifeSeverity,
} from "@/lib/healthTripEngine";
import { describeTrip } from "@/lib/describeTrip";
import {
  BUDGET_LABELS,
  type PlannerAgentId,
  type TripConfig,
} from "@/lib/agent/agentTypes";
import type {
  PlannerAgentState,
  PlannerState,
} from "@/lib/agent/plannerReducer";

/** Props for {@link PlanWorkspace}. */
export interface PlanWorkspaceProps {
  trip: TripConfig;
  plan: HealthTripPlan;
  runToken: number;
  /** False while onboarding covers the workspace; keeps the map sized correctly. */
  visible: boolean;
  onEditTrip: () => void;
  onReplan: () => void;
}

const ID_PREFIX = "workspace";

const ALERT_TONES: Record<SunLifeSeverity, CalloutTone> = {
  ok: "info",
  caution: "caution",
  blocking: "risk",
};

function completedCount(
  agents: Record<PlannerAgentId, PlannerAgentState>,
): number {
  return Object.values(agents).filter((agent) => agent.phase === "complete").length;
}

function statusLabel(state: PlannerState): string {
  if (state.plan !== null) return "Plan ready";
  if (state.status === "running") return "Planning";
  if (state.status === "error") return "Needs attention";
  return "Queued";
}

/**
 * The trip workspace: one compact summary, four ruled tabs, and exactly one visible
 * panel at a time. Every panel stays mounted so the concierge and TinyFish streams keep
 * running while the user moves between Plan, Pacing, Verification, and Team.
 */
export function PlanWorkspace({
  trip,
  plan,
  runToken,
  visible,
  onEditTrip,
  onReplan,
}: PlanWorkspaceProps) {
  const [active, setActive] = useState("plan");
  const { state, runInput, retry } = useAgentPlan({
    destination: trip.destination,
    days: trip.days,
    condition: trip.condition,
    medication: trip.medication,
    interests: trip.interests,
    budget: trip.budget,
    runToken,
  });
  const completed = completedCount(state.agents);
  const tabs: readonly TabItem[] = [
    { id: "plan", label: "Plan" },
    { id: "pacing", label: "Pacing" },
    { id: "verification", label: "Verification" },
    { id: "team", label: "Team", badge: `${completed}/7` },
  ];

  return (
    <main className="page-container pt-10 md:pt-16">
      <div className="flex flex-wrap items-start justify-between gap-6 border-b border-hairline pb-6">
        <div className="min-w-0">
          <p className="t-label text-muted">Current trip</p>
          <h1 className="t-title mt-2 max-w-3xl">
            {describeTrip({
              destination: trip.destination,
              days: trip.days,
              condition: trip.condition,
            })}
          </h1>
          <p className="t-data mt-2 text-muted">
            {BUDGET_LABELS[trip.budget]} ·{" "}
            {trip.interests || "No extra preferences"} ·{" "}
            {trip.hasSunLifeTravelCoverage
              ? "Sun Life coverage recorded"
              : "Sun Life coverage not confirmed"} · {statusLabel(state)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onEditTrip}>
            Edit trip
          </Button>
          <Button variant="secondary" onClick={onReplan}>
            Plan again
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <TabBar
          items={tabs}
          active={active}
          onChange={setActive}
          label="Trip workspace"
          idPrefix={ID_PREFIX}
        />
      </div>

      <div
        role="tabpanel"
        id={`${ID_PREFIX}-panel-plan`}
        aria-labelledby={`${ID_PREFIX}-tab-plan`}
        hidden={active !== "plan"}
        className="pt-8"
      >
        <PlanPanel
          state={state}
          runInput={runInput}
          visible={visible && active === "plan"}
          onRetry={retry}
        />
      </div>

      <div
        role="tabpanel"
        id={`${ID_PREFIX}-panel-pacing`}
        aria-labelledby={`${ID_PREFIX}-tab-pacing`}
        hidden={active !== "pacing"}
        className="pt-8"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="t-title">Safety envelope</h2>
            <p className="t-small mt-2 max-w-2xl text-muted">
              The engine derives daily step, walking, recovery, altitude, and heat
              limits from your condition profile. These limits stay authoritative.
            </p>
          </div>
          <CareCardButton
            destination={trip.destination}
            condition={trip.condition}
            medication={trip.medication}
            plan={plan}
          />
        </div>
        <div className="mt-6">
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
        <div className="mt-8">
          <ItineraryBoard
            plan={plan}
            destination={trip.destination}
            condition={trip.condition}
            medication={trip.medication}
          />
        </div>
      </div>

      <div
        role="tabpanel"
        id={`${ID_PREFIX}-panel-verification`}
        aria-labelledby={`${ID_PREFIX}-tab-verification`}
        hidden={active !== "verification"}
        className="pt-8"
      >
        <h2 className="t-title">Live verification</h2>
        <p className="t-small mt-2 max-w-2xl text-muted">
          Three browser agents check the advisory, medication and customs rules, and
          emergency coverage. Their sessions stream while they work.
        </p>
        <div className="mt-6">
          <AgentSwarmMonitor
            destination={trip.destination}
            condition={trip.condition}
            medication={trip.medication}
            runToken={runToken}
          />
        </div>
      </div>

      <div
        role="tabpanel"
        id={`${ID_PREFIX}-panel-team`}
        aria-labelledby={`${ID_PREFIX}-tab-team`}
        hidden={active !== "team"}
        className="pt-8"
      >
        <AgentTeamPanel
          state={state}
          runInput={runInput}
          onRetry={retry}
        />
      </div>
    </main>
  );
}
