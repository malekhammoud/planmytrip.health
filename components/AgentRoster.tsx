"use client";

import { useState, type CSSProperties } from "react";
import { Button, Disclosure, StatusGlyph, type StatusGlyphState } from "@/components/ui";
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
export const GLYPH: Record<PlannerAgentPhase, StatusGlyphState> = {
  idle: "queued",
  queued: "queued",
  researching: "running",
  writing: "running",
  complete: "done",
  error: "error",
};

export const PHASE_LABEL: Record<PlannerAgentPhase, string> = {
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
export function liveLine(agent: PlannerAgentState): string {
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

/** Props for {@link AgentRoster}. */
export interface AgentRosterProps {
  agents: Record<PlannerAgentId, PlannerAgentState>;
  /** The agent whose activity history is open, or null. */
  expanded: PlannerAgentId | null;
  /** The agent with the newest line, marked so the deck follows live work. */
  latest?: PlannerAgentId | null;
  onToggle: (agent: PlannerAgentId) => void;
}

/**
 * The live seven-agent deck. Only agents that are still working stay open; completed
 * and failed agents fold into one summary that can be reopened. The settled group never
 * disappears, so a result is always available without keeping a report on screen.
 */
export function AgentRoster({ agents, expanded, latest = null, onToggle }: AgentRosterProps) {
  const [settledOpen, setSettledOpen] = useState(false);
  const active = PLANNER_AGENTS.filter((meta) => {
    const phase = agents[meta.id].phase;
    return phase !== "complete" && phase !== "error";
  });
  const settled = PLANNER_AGENTS.filter((meta) => {
    const phase = agents[meta.id].phase;
    return phase === "complete" || phase === "error";
  });

  return (
    <div>
      {active.length === 0 ? (
        <p className="t-small border-t border-solid border-hairline py-3 text-muted">
          All seven agents have reported. Open the completed group to review results.
        </p>
      ) : (
        <ul aria-label="Concierge planning deck" className="agent-roster list-none p-0">
          {active.map((meta) => {
            const index = PLANNER_AGENTS.indexOf(meta);
            const agent = agents[meta.id];
            const primary = liveLine(agent);
            const tone =
              agent.phase === "idle" || agent.phase === "queued"
                ? "text-muted"
                : "text-ink";
            const border = agent.phase === "writing" ? "border-accent" : "border-hairline";
            const span = meta.id === "concierge" ? "md:col-span-2" : "";
            const open = expanded === meta.id;
            const style = { "--agent-index": index } as CSSProperties;
            const detailId = `agent-detail-${meta.id}`;
            return (
              <li
                key={meta.id}
                className={`agent-deck__item border-t py-4 ${border} ${span}`}
                style={style}
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="flex items-center gap-2">
                    <span className="t-data-sm text-muted">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {latest === meta.id ? (
                      <span className="t-label text-accent">Newest</span>
                    ) : null}
                  </span>
                  <StatusGlyph
                    state={GLYPH[agent.phase]}
                    label={PHASE_LABEL[agent.phase]}
                  />
                </div>
                <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3">
                  <h3 className="t-heading text-ink">{meta.name}</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-expanded={open}
                    aria-controls={detailId}
                    onClick={() => onToggle(meta.id)}
                  >
                    {open ? "Hide details" : "Details"}
                  </Button>
                </div>
                <p className="t-data-sm text-muted">{meta.role}</p>
                <p
                  key={primary}
                  className={`agent-activity t-small mt-1 [overflow-wrap:anywhere] ${tone}`}
                >
                  {primary}
                </p>
                <div id={detailId} hidden={!open}>
                  {agent.activity.length > 0 ? (
                    <ol className="mt-2 list-none border-t border-hairline p-0">
                      {agent.activity.slice(-3).map((entry, entryIndex) => (
                        <li
                          key={`${entryIndex}-${entry}`}
                          className="t-data-sm border-b border-hairline py-1 text-muted [overflow-wrap:anywhere] last:border-b-0"
                        >
                          {entry}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="t-data-sm mt-2 text-muted">No activity lines yet.</p>
                  )}
                  {agent.resultSummary !== null && agent.phase === "complete" ? (
                    <p className="t-small mt-2 text-ink [overflow-wrap:anywhere]">
                      Result: {agent.resultSummary}
                    </p>
                  ) : null}
                  {agent.error !== null && agent.phase === "error" ? (
                    <p className="t-small mt-2 text-risk [overflow-wrap:anywhere]">
                      {agent.error}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {settled.length > 0 ? (
        <div className="mt-2 border-t border-solid border-hairline">
          <Disclosure
            title="Completed agents"
            summary={`${settled.length} of 7`}
            open={settledOpen}
            onToggle={() => setSettledOpen((current) => !current)}
          >
            <ul className="list-none p-0">
              {settled.map((meta) => {
                const agent = agents[meta.id];
                const result =
                  agent.phase === "error"
                    ? agent.error ?? "No usable result returned."
                    : agent.resultSummary ?? "Research complete.";
                return (
                  <li
                    key={meta.id}
                    className="border-b border-solid border-hairline py-2 last:border-b-0"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="t-heading text-ink">{meta.name}</p>
                      <StatusGlyph
                        state={GLYPH[agent.phase]}
                        label={PHASE_LABEL[agent.phase]}
                      />
                    </div>
                    <p className="t-small mt-1 text-muted [overflow-wrap:anywhere]">
                      {result}
                    </p>
                    {agent.error !== null && agent.phase === "error" ? (
                      <p className="t-small mt-1 text-risk [overflow-wrap:anywhere]">
                        Retry the concierge to recover this specialist.
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Disclosure>
        </div>
      ) : null}
    </div>
  );
}
