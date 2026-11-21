"use client";

import { AgentActivityFeed } from "@/components/AgentActivityFeed";
import { AgentPlanView } from "@/components/AgentPlanView";
import { AgentRoster } from "@/components/AgentRoster";
import { Button, Callout } from "@/components/ui";
import { useAgentPlan } from "@/hooks/useAgentPlan";
import type { PlannerAgentState } from "@/lib/agent/plannerReducer";
import {
  BUDGET_LABELS,
  type BudgetLevel,
  type PlannerAgentId,
} from "@/lib/agent/agentTypes";
import { CONDITION_LABELS, type Condition } from "@/lib/types";

/** Props for {@link AgentPlanner}; every value is owned by the page. */
export interface AgentPlannerProps {
  destination: string;
  days: number;
  condition: Condition;
  medication: string;
  interests: string;
  budget: BudgetLevel;
  /** 0 before the first Deploy. */
  runToken: number;
  /** Re-runs the planner and live risk checks from the rail. */
  onReplan: () => void;
}

function completedCount(
  agents: Record<PlannerAgentId, PlannerAgentState>,
): number {
  return Object.values(agents).filter((agent) => agent.phase === "complete").length;
}

/**
 * The concierge board: the seven-agent roster, a live activity log, and the finished
 * map and day plan. Token 0 renders the designed empty state and never fetches.
 */
export function AgentPlanner({
  destination,
  days,
  condition,
  medication,
  interests,
  budget,
  runToken,
  onReplan,
}: AgentPlannerProps) {
  const { state, runInput, retry } = useAgentPlan({
    destination,
    days,
    condition,
    medication,
    interests,
    budget,
    runToken,
  });
  const hasDestination = destination.trim().length > 0;
  const idle = state.status === "idle";
  const inputsChanged =
    runInput !== null &&
    (destination.trim() !== runInput.destination ||
      days !== runInput.days ||
      condition !== runInput.condition ||
      medication.trim() !== runInput.medication ||
      interests.trim() !== runInput.interests ||
      budget !== runInput.budget);

  if (!hasDestination) {
    return (
      <p className="t-small text-muted">
        Add a destination to send the concierge team.
      </p>
    );
  }

  if (idle) {
    return (
      <div>
        <p className="t-body measure text-muted">
          Deploy to send six research specialists across stays, tables, trails, culture,
          transit, and care. A concierge then sequences their verified picks into days,
          recovery, and a route map.
        </p>
        <div className="mt-6">
          <AgentRoster agents={state.agents} />
        </div>
      </div>
    );
  }

  return (
    <div>
      {state.mock ? (
        <div className="mb-6">
          <Callout tone="caution" title="Mock planning data">
            These agents ran in mock mode. The places, prices, and route are sample data.
          </Callout>
        </div>
      ) : null}

      {runInput !== null ? (
        <div className="flex flex-col gap-1">
          <p className="t-small text-muted">
            Last plan: {runInput.destination} · {runInput.days} days ·{" "}
            {CONDITION_LABELS[runInput.condition]} · {BUDGET_LABELS[runInput.budget]}
          </p>
          {inputsChanged ? (
            <p className="t-small text-caution">
              Inputs changed since this plan. Deploy again to replan.
            </p>
          ) : null}
        </div>
      ) : null}

      {state.error !== null ? (
        <div className="mt-6">
          <Callout
            tone={state.error.code === "agent_unavailable" ? "caution" : "risk"}
            title="Planning paused"
          >
            <p>{state.error.message}</p>
            <div className="mt-3">
              <Button variant="secondary" onClick={retry}>
                Try the concierge again
              </Button>
            </div>
          </Callout>
        </div>
      ) : null}

      {state.plan !== null ? (
        <div className="mt-8">
          <AgentPlanView plan={state.plan} />
          <details className="mt-10 border-t border-hairline pt-4">
            <summary className="t-small min-h-11 cursor-pointer text-muted">
              Research team · {completedCount(state.agents)} of 7 complete
            </summary>
            <div className="mt-4">
              <AgentRoster agents={state.agents} />
            </div>
          </details>
          <div className="mt-8">
            <Button variant="secondary" onClick={onReplan}>
              Replan this trip
            </Button>
          </div>
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
