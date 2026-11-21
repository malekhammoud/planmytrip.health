"use client";

import type { PlannerLogEntry } from "@/lib/agent/plannerReducer";
import { PLANNER_AGENTS } from "@/lib/agent/agentTypes";

const NAMES = new Map(PLANNER_AGENTS.map((agent) => [agent.id, agent.name]));

const KIND_LABEL: Record<PlannerLogEntry["kind"], string> = {
  search: "Search",
  read: "Read",
  note: "Note",
  tool: "Tool",
  error: "Issue",
};

function clock(ts: string): string {
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "--:--:--";
  return date.toISOString().slice(11, 19);
}

/** Shared, bounded activity log for the seven planner agents. */
export function AgentActivityFeed({ log }: { log: readonly PlannerLogEntry[] }) {
  const entries = log.slice(-12);
  return (
    <div className="mt-6 border-t border-hairline pt-4">
      <div className="flex items-baseline justify-between gap-4">
        <p className="t-label text-muted">Live planning log</p>
        <p className="t-data-sm text-muted">{log.length} updates</p>
      </div>
      {entries.length === 0 ? (
        <p className="t-small mt-2 text-muted">
          The team is queued. Research activity will appear here.
        </p>
      ) : (
        <ol aria-label="Live planning activity" className="mt-2 list-none p-0">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-hairline py-2"
            >
              <span className="t-data-sm w-16 shrink-0 text-muted">{clock(entry.ts)}</span>
              <span className="t-label shrink-0 text-muted">{KIND_LABEL[entry.kind]}</span>
              <span className="t-data-sm shrink-0 text-ink">
                {NAMES.get(entry.agentId) ?? "Planner"}
              </span>
              <span className="t-small min-w-0 flex-1 text-muted [overflow-wrap:anywhere]">
                {entry.text}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
