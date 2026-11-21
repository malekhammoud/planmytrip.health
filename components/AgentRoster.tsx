"use client";

import type { CSSProperties } from "react";
import { StatusGlyph, type StatusGlyphState } from "@/components/ui";
import type { PlannerAgentState } from "@/lib/agent/plannerReducer";
import {
  PLANNER_AGENTS,
  type PlannerAgentId,
  type PlannerAgentPhase,
} from "@/lib/agent/agentTypes";

/**
 * The phase vocabulary the deck shows. The reducer still uses `queued`; the interface
 * never does, because "Starting" describes what the traveler is waiting for.
 */
const GLYPH: Record<PlannerAgentPhase, StatusGlyphState> = {
  idle: "queued",
  queued: "queued",
  researching: "running",
  writing: "running",
  complete: "done",
  error: "error",
};

const LABEL: Record<PlannerAgentPhase, string> = {
  idle: "Ready",
  queued: "Starting",
  researching: "Researching",
  writing: "Composing",
  complete: "Complete",
  error: "Incomplete",
};

const FALLBACK: Record<PlannerAgentPhase, string> = {
  idle: "Ready when the next plan runs.",
  queued: "Opening the session.",
  researching: "Reading live sources.",
  writing: "Composing the JSON summary.",
  complete: "Research complete.",
  error: "No usable result returned.",
};

/**
 * Returns the newest live line for one agent. The planner may attach a bounded
 * `message` to the state; until it does, the latest activity line stands in.
 */
function liveLine(agent: PlannerAgentState): string {
  if (typeof agent.message === "string" && agent.message.trim().length > 0) {
    return agent.message.trim();
  }
  const latest = agent.activity[agent.activity.length - 1];
  if (latest !== undefined && latest.trim().length > 0) return latest.trim();
  if (agent.phase === "complete" && agent.resultSummary !== null) {
    return agent.resultSummary;
  }
  if (agent.phase === "error" && agent.error !== null) return agent.error;
  return FALLBACK[agent.phase];
}

/** The seven-agent live deck: phase label, role, newest line, and result or error. */
export function AgentRoster({
  agents,
}: {
  agents: Record<PlannerAgentId, PlannerAgentState>;
}) {
  return (
    <ul
      aria-label="Concierge planning deck"
      className="grid list-none grid-cols-1 gap-x-8 p-0 md:grid-cols-2 xl:grid-cols-3"
    >
      {PLANNER_AGENTS.map((meta, index) => {
        const agent = agents[meta.id];
        const primary = liveLine(agent);
        const tone = agent.phase === "idle" || agent.phase === "queued" ? "text-muted" : "text-ink";
        const border = agent.phase === "writing" ? "border-accent" : "border-hairline";
        const span = meta.id === "concierge" ? "md:col-span-2 xl:col-span-3" : "";
        const style = { "--agent-index": index } as CSSProperties;
        return (
          <li
            key={meta.id}
            className={`agent-deck__item border-t py-5 ${border} ${span}`}
            style={style}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="t-data-sm text-muted">
                {String(index + 1).padStart(2, "0")}
              </span>
              <StatusGlyph state={GLYPH[agent.phase]} label={LABEL[agent.phase]} />
            </div>
            <h3 className="t-heading mt-2 text-ink">{meta.name}</h3>
            <p className="t-data-sm text-muted">{meta.role}</p>
            <p
              key={primary}
              className={`agent-activity t-small mt-2 [overflow-wrap:anywhere] ${tone}`}
            >
              {primary}
            </p>
            {agent.resultSummary !== null &&
            agent.phase === "complete" &&
            agent.resultSummary !== primary ? (
              <p className="t-data-sm mt-1 text-muted [overflow-wrap:anywhere]">
                Result: {agent.resultSummary}
              </p>
            ) : null}
            {agent.error !== null &&
            agent.phase === "error" &&
            agent.error !== primary ? (
              <p className="t-small mt-1 text-risk [overflow-wrap:anywhere]">
                {agent.error}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
