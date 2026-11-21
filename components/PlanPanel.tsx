"use client";

import { AgentActivityFeed } from "@/components/AgentActivityFeed";
import { AgentPlanView } from "@/components/AgentPlanView";
import { AgentRoster } from "@/components/AgentRoster";
import { Button, Callout } from "@/components/ui";
import type { AgentPlanRunInput } from "@/hooks/useAgentPlan";
import type { PlannerState } from "@/lib/agent/plannerReducer";
import {
  BUDGET_LABELS,
  type PlannerAgentId,
} from "@/lib/agent/agentTypes";
import type { PlannerAgentState } from "@/lib/agent/plannerReducer";
import { CONDITION_LABELS } from "@/lib/types";

/** Props for {@link PlanPanel}. */
export interface PlanPanelProps {
  state: PlannerState;
  runInput: AgentPlanRunInput | null;
  visible: boolean;
  onRetry: () => void;
}

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
      {CONDITION_LABELS[runInput.condition]} · {BUDGET_LABELS[runInput.budget]}
    </p>
  );
}

/**
 * The Plan tab. A ready plan leads; while the team is researching, the roster and
 * bounded activity feed carry the surface. The full team lives in its own tab.
 */
export function PlanPanel({
  state,
  runInput,
  visible,
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
        <AgentPlanView plan={state.plan} visible={visible} />
      </div>
    );
  }

  return (
    <div>
      {mockNote}
      <RunContext runInput={runInput} />

      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-4">
        <p className="t-label text-muted">Concierge team</p>
        <p className="t-data text-muted">
          {completedCount(state.agents)} of 7 complete
        </p>
      </div>
      <div className="mt-2">
        <AgentRoster agents={state.agents} />
      </div>

      {state.status === "running" ? <AgentActivityFeed log={state.log} /> : null}

      {state.error !== null ? (
        <div className="mt-6">
          <Callout
            tone={state.error.code === "agent_unavailable" ? "caution" : "risk"}
            title="Planning paused"
          >
            <p>{state.error.message}</p>
            <div className="mt-3">
              <Button variant="secondary" onClick={onRetry}>
                Try the concierge again
              </Button>
            </div>
          </Callout>
        </div>
      ) : null}
    </div>
  );
}
