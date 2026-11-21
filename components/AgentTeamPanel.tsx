"use client";

import { AgentActivityFeed } from "@/components/AgentActivityFeed";
import { AgentRoster } from "@/components/AgentRoster";
import { Button, Callout } from "@/components/ui";
import type { AgentPlanRunInput } from "@/hooks/useAgentPlan";
import type { PlannerState } from "@/lib/agent/plannerReducer";
import { BUDGET_LABELS, type PlannerAgentId } from "@/lib/agent/agentTypes";
import type { PlannerAgentState } from "@/lib/agent/plannerReducer";
import { CONDITION_LABELS } from "@/lib/types";

/** Props for {@link AgentTeamPanel}. */
export interface AgentTeamPanelProps {
  state: PlannerState;
  runInput: AgentPlanRunInput | null;
  onRetry: () => void;
}

function completedCount(
  agents: Record<PlannerAgentId, PlannerAgentState>,
): number {
  return Object.values(agents).filter((agent) => agent.phase === "complete").length;
}

/** Full research-team view: roster, current activity, run context, and retry. */
export function AgentTeamPanel({
  state,
  runInput,
  onRetry,
}: AgentTeamPanelProps) {
  return (
    <div>
      {runInput !== null ? (
        <p className="t-small text-muted">
          Last plan: {runInput.destination} · {runInput.days} days ·{" "}
          {CONDITION_LABELS[runInput.condition]} · {BUDGET_LABELS[runInput.budget]}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-4">
        <p className="t-label text-muted">Research team</p>
        <p className="t-data text-muted">
          {completedCount(state.agents)} of 7 complete
        </p>
      </div>
      <div className="mt-2">
        <AgentRoster agents={state.agents} />
      </div>
      <AgentActivityFeed log={state.log} />

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
