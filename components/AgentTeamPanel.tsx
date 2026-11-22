"use client";

import { useState } from "react";
import {
  AgentRoster,
  GLYPH,
  PHASE_LABEL,
  liveLine,
} from "@/components/AgentRoster";
import { Button, StatusGlyph } from "@/components/ui";
import { newestAgent } from "@/lib/agent/plannerStage";
import type { MissionStage } from "@/lib/agent/plannerStage";
import type { PlannerState } from "@/lib/agent/plannerReducer";
import {
  PLANNER_AGENTS,
  type PlannerAgentId,
} from "@/lib/agent/agentTypes";

/** Props for {@link AgentTeamPanel}. */
export interface AgentTeamPanelProps {
  state: PlannerState;
  /** True once the route is ready: the deck compacts to a focusable strip. */
  compact: boolean;
  /** Current stage, used only for the deck's stage line. */
  stage: MissionStage;
}

const STAGE_LINE: Record<MissionStage, string> = {
  starting: "Opening seven sessions",
  researching: "Specialists reading live sources",
  composing: "Concierge sequencing verified picks",
  ready: "All research in",
  error: "Run stopped before a result",
};

/** Seven-agent deck: live roster while planning, a compact focusable strip when ready. */
export function AgentTeamPanel({ state, compact, stage }: AgentTeamPanelProps) {
  const [expanded, setExpanded] = useState<PlannerAgentId | null>(null);
  const [pinned, setPinned] = useState<PlannerAgentId | null>(null);
  const newest = newestAgent(state);
  const focused = pinned ?? newest ?? "concierge";
  const focusedMeta = PLANNER_AGENTS.find((meta) => meta.id === focused) ?? PLANNER_AGENTS[0];
  const focusedAgent = state.agents[focusedMeta.id];
  const following = pinned === null;

  return (
    <div>
      <p className="t-data-sm text-muted">{STAGE_LINE[stage]}</p>

      {compact ? (
        <div className="mt-3">
          <div
            role="group"
            aria-label="Focus one planning agent"
            className="agent-strip"
          >
            {PLANNER_AGENTS.map((meta) => {
              const agent = state.agents[meta.id];
              const selected = meta.id === focused;
              return (
                <div
                  key={meta.id}
                  className={`min-w-0 border-t-2 pt-1 ${
                    selected ? "border-accent" : "border-hairline"
                  }`}
                >
                  <Button
                    variant={selected ? "primary" : "secondary"}
                    size="sm"
                    aria-pressed={selected}
                    onClick={() => setPinned(meta.id)}
                    className="w-full min-w-0"
                  >
                    <span className="agent-strip__label">{meta.name}</span>
                  </Button>
                  <p className="t-data-sm mt-1 truncate text-muted">
                    {PHASE_LABEL[agent.phase]}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex min-h-6 flex-wrap items-center justify-between gap-2">
            <p className="t-data-sm text-muted">
              {following ? "Following the newest line" : `Pinned to ${focusedMeta.name}`}
            </p>
            {following ? null : (
              <Button variant="ghost" size="sm" onClick={() => setPinned(null)}>
                Follow the team
              </Button>
            )}
          </div>

          <div
            key={focusedMeta.id}
            className="anim-rise mt-2 border-t border-solid border-hairline pt-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <p className="t-heading text-ink">{focusedMeta.name}</p>
                <p className="t-data-sm text-muted">{focusedMeta.role}</p>
              </div>
              <StatusGlyph
                state={GLYPH[focusedAgent.phase]}
                label={PHASE_LABEL[focusedAgent.phase]}
              />
            </div>
            <p className="t-data-sm mt-2 text-muted">{focusedMeta.checks}</p>
            <p
              key={liveLine(focusedAgent)}
              className="agent-activity t-small mt-1 text-ink [overflow-wrap:anywhere]"
            >
              {liveLine(focusedAgent)}
            </p>
            {focusedAgent.activity.length > 0 ? (
              <ol className="mt-2 list-none border-t border-hairline p-0">
                {focusedAgent.activity.slice(-3).map((entry, index) => (
                  <li
                    key={`${index}-${entry}`}
                    className="t-data-sm border-b border-hairline py-1 text-muted [overflow-wrap:anywhere] last:border-b-0"
                  >
                    {entry}
                  </li>
                ))}
              </ol>
            ) : null}
            {focusedAgent.resultSummary !== null && focusedAgent.phase === "complete" ? (
              <p className="t-small mt-2 text-ink [overflow-wrap:anywhere]">
                Result: {focusedAgent.resultSummary}
              </p>
            ) : null}
            {focusedAgent.error !== null && focusedAgent.phase === "error" ? (
              <p className="t-small mt-2 text-risk [overflow-wrap:anywhere]">
                {focusedAgent.error}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <AgentRoster
            agents={state.agents}
            expanded={expanded}
            latest={newest}
            onToggle={(agent) =>
              setExpanded((current) => (current === agent ? null : agent))
            }
          />
        </div>
      )}
    </div>
  );
}
