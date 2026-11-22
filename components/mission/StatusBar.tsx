/**
 * Verification status row.
 *
 * Inputs: the swarm state, its summary, an optional announcement, and re-run action.
 * Outputs: the running or settled phrase, the done action, and the polite live line.
 * Invariants: counts come from accepted events only; the workspace command bar carries
 * the clocks and counters, so this row stays a thin ruled line, never a second header.
 */

"use client";

import { Button } from "@/components/ui";
import type { SwarmState } from "@/lib/swarmReducer";
import type { SwarmSummary } from "@/lib/swarmTelemetry";
import { WORKER_IDS, type WorkerId } from "@/lib/swarmTypes";

/** Props for {@link StatusBar}. */
export interface StatusBarProps {
  state: SwarmState;
  summary: SwarmSummary;
  onRerun: () => void;
  /** Bounded, throttled state-change copy for screen readers. */
  announcement: string;
}

/** The verification panel's status line and re-run action. */
export function StatusBar({ state, summary, onRerun, announcement }: StatusBarProps) {
  const settled = WORKER_IDS.every((worker: WorkerId) => {
    const phase = state.workers[worker].phase;
    return phase === "complete" || phase === "error";
  });
  const done = settled && summary.running === 0;
  const left = done
    ? "Verification complete"
    : summary.running > 0
      ? `${summary.running} ${summary.running === 1 ? "agent" : "agents"} running`
      : "Verification ready";

  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-solid border-hairline py-1">
      <p className="t-data text-ink">{left}</p>
      <div className="flex items-center gap-3">
        <p className="t-data-sm text-muted">
          {summary.findings} of 3 findings
        </p>
        {done ? (
          <Button variant="secondary" size="sm" onClick={onRerun}>
            Re-run
          </Button>
        ) : null}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
