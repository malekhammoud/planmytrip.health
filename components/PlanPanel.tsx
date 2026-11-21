"use client";

import type { CSSProperties } from "react";
import { AgentPlanView } from "@/components/AgentPlanView";
import { Button, Callout, Skeleton } from "@/components/ui";
import type { AgentPlanRunInput } from "@/hooks/useAgentPlan";
import type { PlannerState } from "@/lib/agent/plannerReducer";
import { BUDGET_LABELS, type PlannerAgentId } from "@/lib/agent/agentTypes";
import type { PlannerAgentState } from "@/lib/agent/plannerReducer";
import type { TripCaptureContext } from "@/lib/data/types";
import { CONDITION_LABELS, TRANSPORT_LABELS, type TransportMode } from "@/lib/types";

/** Props for {@link PlanPanel}. */
export interface PlanPanelProps {
  state: PlannerState;
  runInput: AgentPlanRunInput | null;
  visible: boolean;
  /** Free-text starting point used by the arrival map link. */
  origin: string;
  /** Travel method used to order stops and choose each leg's mode. */
  transport: TransportMode;
  capture: TripCaptureContext;
  onRetry: () => void;
}

const ROUTE_PATH =
  "M 12 112 C 72 104 96 42 158 56 S 240 124 316 94 S 430 30 500 54 S 596 102 628 64";

const ROUTE_NODES: readonly { left: string; top: string }[] = [
  { left: "2%", top: "75%" },
  { left: "25%", top: "37%" },
  { left: "49%", top: "63%" },
  { left: "78%", top: "36%" },
  { left: "98%", top: "43%" },
];

const DAY_SLOTS: readonly string[] = ["01", "02", "03"];

function completedCount(
  agents: Record<PlannerAgentId, PlannerAgentState>,
): number {
  return Object.values(agents).filter((agent) => agent.phase === "complete").length;
}

function RunContext({ runInput }: { runInput: AgentPlanRunInput | null }) {
  if (runInput === null) return null;
  return (
    <p className="t-small text-muted">
      Last plan: {runInput.destination} · {runInput.days} days ·{" "}
      {TRANSPORT_LABELS[runInput.transport]} · {CONDITION_LABELS[runInput.condition]} ·{" "}
      {BUDGET_LABELS[runInput.budget]}
    </p>
  );
}

/**
 * The live route stage. The finished concierge plan leads when ready; a designed
 * route-forming frame holds the space while the run is live; a failure keeps the
 * calm retry in place. The engine envelope below never depends on this panel.
 */
function RouteForming({ completed }: { completed: number }) {
  const status =
    completed >= 7
      ? "All seven agents are in. The concierge is writing the final route."
      : `${completed} of 7 agents complete. The map appears when the route is ready.`;
  return (
    <div className="rounded-frame border border-hairline-strong bg-surface p-4 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="t-label text-muted">Route forming</p>
        <p className="t-data-sm text-muted">{completed} / 7 agents</p>
      </div>
      <p role="status" aria-live="polite" className="t-small mt-1 text-muted">
        {status}
      </p>

      <div className="relative mt-6 h-32 w-full" aria-hidden="true">
        <svg
          viewBox="0 0 640 150"
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
        >
          <path
            className="route-forming__base"
            d={ROUTE_PATH}
            vectorEffect="non-scaling-stroke"
          />
          <path
            className="route-forming__route"
            d={ROUTE_PATH}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {ROUTE_NODES.map((node, index) => {
          const style = {
            left: node.left,
            top: node.top,
            "--node-index": index,
          } as CSSProperties;
          return <span key={node.left} className="route-forming__node" style={style} />;
        })}
      </div>

      <div className="mt-2 grid grid-cols-1 gap-6 border-t border-hairline pt-5 md:grid-cols-3">
        {DAY_SLOTS.map((day) => (
          <div key={day}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="t-label text-muted">Day {day}</p>
              <p className="t-data-sm text-muted">Pending</p>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <Skeleton height={12} width="72%" />
              <Skeleton height={12} width="100%" />
              <Skeleton height={12} width="84%" />
              <Skeleton height={32} width="100%" />
            </div>
          </div>
        ))}
      </div>
      <p className="t-small mt-5 text-muted">
        The engine safety envelope below is already final.
      </p>
    </div>
  );
}

/** Route and itinerary stage: live skeleton, retry, or the finished agent plan. */
export function PlanPanel({
  state,
  runInput,
  visible,
  origin,
  transport,
  capture,
  onRetry,
}: PlanPanelProps) {
  const mockNote = state.mock ? (
    <div className="mb-6">
      <Callout tone="caution" title="Mock planning data">
        These agents ran in mock mode. The places, prices, and route are sample data.
      </Callout>
    </div>
  ) : null;

  if (state.plan !== null) {
    return (
      <div>
        {mockNote}
        <AgentPlanView
          plan={state.plan}
          visible={visible}
          origin={origin}
          transport={transport}
          capture={capture}
        />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div>
        {mockNote}
        <RunContext runInput={runInput} />
        <div className="mt-4">
          <Callout
            tone={state.error?.code === "agent_unavailable" ? "caution" : "risk"}
            title="Planning paused"
          >
            <p>{state.error?.message ?? "The concierge did not return a plan."}</p>
            <p className="mt-2">
              The safety envelope and live verification below keep running.
            </p>
            <div className="mt-3">
              <Button variant="secondary" onClick={onRetry}>
                Try the concierge again
              </Button>
            </div>
          </Callout>
        </div>
      </div>
    );
  }

  return (
    <div>
      {mockNote}
      <RunContext runInput={runInput} />
      <div className="mt-4">
        <RouteForming completed={completedCount(state.agents)} />
      </div>
    </div>
  );
}
