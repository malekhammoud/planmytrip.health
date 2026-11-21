"use client";

import { StatusGlyph, type StatusGlyphState } from "@/components/ui";
import type { PlannerAgentState } from "@/lib/agent/plannerReducer";
import { PLANNER_AGENTS, type PlannerAgentId, type PlannerAgentPhase } from "@/lib/agent/agentTypes";

const GLYPH: Record<PlannerAgentPhase, StatusGlyphState> = {
  idle: "queued",
  queued: "queued",
  researching: "running",
  writing: "running",
  complete: "done",
  error: "error",
};

const LABEL: Record<PlannerAgentPhase, string> = {
  idle: "Not run yet",
  queued: "Queued",
  researching: "Researching",
  writing: "Writing",
  complete: "Complete",
  error: "Could not finish",
};

/** The seven-agent roster with current phase and latest activity. */
export function AgentRoster({
  agents,
}: {
  agents: Record<PlannerAgentId, PlannerAgentState>;
}) {
  return (
    <ul className="grid list-none grid-cols-1 gap-x-8 p-0 md:grid-cols-2">
      {PLANNER_AGENTS.map((meta) => {
        const agent = agents[meta.id];
        const latest = agent.activity[agent.activity.length - 1];
        return (
          <li key={meta.id} className="border-t border-hairline py-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <StatusGlyph state={GLYPH[agent.phase]} label={LABEL[agent.phase]} />
              <p className="t-heading text-ink">{meta.name}</p>
              <p className="t-data text-muted">{meta.role}</p>
            </div>
            {latest ? (
              <p className="t-small mt-1 text-muted [overflow-wrap:anywhere]">{latest}</p>
            ) : (
              <p className="t-small mt-1 text-muted">{meta.checks}</p>
            )}
            {agent.resultSummary !== null && agent.phase === "complete" ? (
              <p className="t-data-sm mt-1 text-muted">{agent.resultSummary}</p>
            ) : null}
            {agent.error !== null ? (
              <p className="t-small mt-1 text-risk [overflow-wrap:anywhere]">{agent.error}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
