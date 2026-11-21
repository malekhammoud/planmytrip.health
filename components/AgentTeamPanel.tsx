"use client";

import { AgentActivityFeed } from "@/components/AgentActivityFeed";
import { AgentRoster } from "@/components/AgentRoster";
import type { AgentPlanRunInput } from "@/hooks/useAgentPlan";
import type { PlannerState } from "@/lib/agent/plannerReducer";
import { BUDGET_LABELS } from "@/lib/agent/agentTypes";
import { CONDITION_LABELS } from "@/lib/types";

/** Props for {@link AgentTeamPanel}. */
export interface AgentTeamPanelProps {
  state: PlannerState;
  runInput: AgentPlanRunInput | null;
}

/** Seven-agent deck plus the planning signal, kept live for the whole workspace. */
export function AgentTeamPanel({ state, runInput }: AgentTeamPanelProps) {
  const agents = Object.values(state.agents);
  const completed = agents.filter((agent) => agent.phase === "complete").length;
  const incomplete = agents.filter((agent) => agent.phase === "error").length;

  return (
    <div>
      {runInput !== null ? (
        <p className="t-small text-muted">
          Last plan: {runInput.destination} · {runInput.days} days ·{" "}
          {CONDITION_LABELS[runInput.condition]} · {BUDGET_LABELS[runInput.budget]}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-4 border-b border-hairline pb-2">
        <p className="t-label text-muted">Seven-agent deck</p>
        <p className="t-data text-muted">
          {completed} of 7 complete
          {incomplete > 0 ? ` · ${incomplete} incomplete` : ""}
        </p>
      </div>
      <AgentRoster agents={state.agents} />
      <AgentActivityFeed log={state.log} />
    </div>
  );
}
