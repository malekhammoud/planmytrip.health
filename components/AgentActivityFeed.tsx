"use client";

import { useState, type CSSProperties } from "react";
import type { PlannerLogEntry } from "@/lib/agent/plannerReducer";
import { Disclosure } from "@/components/ui";
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

/** Deterministic bar height from the line length, so a redraw never reshuffles. */
function barHeight(entry: PlannerLogEntry): number {
  return 8 + ((entry.text.length * 5 + kindWeight(entry.kind)) % 40);
}

function kindWeight(kind: PlannerLogEntry["kind"]): number {
  return kind === "error" ? 17 : kind === "search" ? 11 : kind === "read" ? 7 : 3;
}

function SignalGraph({ entries }: { entries: readonly PlannerLogEntry[] }) {
  const latestId = entries[entries.length - 1]?.id;
  return (
    <div
      aria-hidden="true"
      className="mt-3 flex h-14 items-end gap-1 border-b border-hairline pb-1"
    >
      {entries.map((entry, index) => {
        const latest = entry.id === latestId;
        const tone =
          entry.kind === "error"
            ? "bg-risk"
            : latest
              ? "signal-bar--live bg-accent"
              : "bg-hairline-strong";
        const style = {
          height: barHeight(entry),
          "--signal-index": index,
        } as CSSProperties;
        return (
          <span
            key={entry.id}
            className={`signal-bar block min-w-0 flex-1 ${tone}`}
            style={style}
          />
        );
      })}
    </div>
  );
}

/**
 * Planning signal: a bar graph and ticker built from the bounded planner log. The
 * graph is decorative; the ticker is the text equivalent. The newest line carries an
 * arrival wash so a new event is visible in the rail without a live-region announcement.
 */
export function AgentActivityFeed({
  log,
  live = false,
}: {
  log: readonly PlannerLogEntry[];
  /** True while the planner stream is running; only then is the newest bar live. */
  live?: boolean;
}) {
  const [earlierOpen, setEarlierOpen] = useState(false);
  const bars = log.slice(-28);
  const recent = log.slice(-2).reverse();
  const earlier = log.slice(-22, -2).reverse();
  return (
    <div className="mt-8 border-t border-hairline pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="t-label flex items-center gap-2 text-muted">
          {live ? (
            <span aria-hidden="true" className="anim-pulse-dot block h-1.5 w-1.5 bg-accent" />
          ) : null}
          Planning signal
        </p>
        <p className="t-data-sm text-muted">
          {live ? "Live · " : ""}
          {log.length} updates
        </p>
      </div>

      {bars.length === 0 ? (
        <p className="t-small mt-2 text-muted">
          No planning signal yet. The first search line appears here.
        </p>
      ) : (
        <>
          <SignalGraph entries={bars} />
          <ol aria-label="Recent planning activity" className="mt-2 list-none p-0">
            {recent.map((entry, index) => (
              <li
                key={entry.id}
                className={`ticker-line flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-hairline py-2 ${
                  index === 0 ? "anim-arrive" : ""
                }`}
              >
                <span className="t-data-sm w-16 shrink-0 text-muted">
                  {clock(entry.ts)}
                </span>
                <span
                  className={`t-label shrink-0 ${
                    entry.kind === "error" ? "text-risk" : "text-muted"
                  }`}
                >
                  {KIND_LABEL[entry.kind]}
                </span>
                <span className="t-data-sm shrink-0 text-ink">
                  {NAMES.get(entry.agentId) ?? "Planner"}
                </span>
                <span className="t-small mt-1 basis-full min-w-0 text-muted [overflow-wrap:anywhere] md:mt-0 md:basis-auto md:flex-1">
                  {entry.text}
                </span>
              </li>
            ))}
          </ol>
          {earlier.length > 0 ? (
            <div className="mt-2 border-t border-solid border-hairline">
              <Disclosure
                title="Earlier updates"
                summary={`${earlier.length} earlier`}
                open={earlierOpen}
                onToggle={() => setEarlierOpen((current) => !current)}
              >
                <ol aria-label="Earlier planning activity" className="list-none p-0">
                  {earlier.map((entry) => (
                    <li
                      key={entry.id}
                      className="ticker-line flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-hairline py-2"
                    >
                      <span className="t-data-sm w-16 shrink-0 text-muted">
                        {clock(entry.ts)}
                      </span>
                      <span
                        className={`t-label shrink-0 ${
                          entry.kind === "error" ? "text-risk" : "text-muted"
                        }`}
                      >
                        {KIND_LABEL[entry.kind]}
                      </span>
                      <span className="t-data-sm shrink-0 text-ink">
                        {NAMES.get(entry.agentId) ?? "Planner"}
                      </span>
                      <span className="t-small mt-1 basis-full min-w-0 text-muted [overflow-wrap:anywhere] md:mt-0 md:basis-auto md:flex-1">
                        {entry.text}
                      </span>
                    </li>
                  ))}
                </ol>
              </Disclosure>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
