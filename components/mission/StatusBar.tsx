/**
 * Sticky 48px mission status bar.
 *
 * Inputs: the swarm state, its summary, an optional announcement, and re-run action.
 * Outputs: running count, elapsed time, steps, sources, findings, and the done action.
 * Invariants: counts come from accepted events only; the elapsed clock is isolated in
 * Elapsed; the polite live line only repeats real state changes.
 */

"use client";

import { Button } from "@/components/ui";
import { Elapsed } from "@/components/mission/Elapsed";
import type { SwarmState } from "@/lib/swarmReducer";
import type { SwarmSummary } from "@/lib/swarmTelemetry";
import type { WorkerId } from "@/lib/swarmTypes";
import { WORKER_IDS } from "@/lib/swarmTypes";

/** Props for {@link StatusBar}. */
export interface StatusBarProps {
  state: SwarmState;
  summary: SwarmSummary;
  onRerun: () => void;
  /** Bounded, throttled state-change copy for screen readers. */
  announcement: string;
}

function swarmWindow(state: SwarmState): { startedAt: number | null; endedAt: number | null } {
  let startedAt: number | null = null;
  let endedAt: number | null = null;
  let live = false;
  for (const worker of Object.values(state.workers)) {
    if (worker.startedAt !== null) {
      startedAt = startedAt === null ? worker.startedAt : Math.min(startedAt, worker.startedAt);
    }
    if (worker.phase === "queued" || worker.phase === "running") live = true;
    if (worker.endedAt !== null) {
      endedAt = endedAt === null ? worker.endedAt : Math.max(endedAt, worker.endedAt);
    }
  }
  return { startedAt, endedAt: live ? null : endedAt };
}

/** The mission's only sticky surface. */
export function StatusBar({ state, summary, onRerun, announcement }: StatusBarProps) {
  const { startedAt, endedAt } = swarmWindow(state);
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
    <div className="sticky top-0 z-10 border-y border-solid border-hairline bg-paper">
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-6 gap-y-1 py-1">
        <p className="t-data text-ink">{left}</p>
        <p className="t-data text-muted">
          <Elapsed startedAt={startedAt} endedAt={endedAt} />
        </p>
        <p className="t-data text-muted">
          {summary.steps} steps, {summary.sources} sources, {summary.findings} of 3 findings
        </p>
        {done ? (
          <Button variant="secondary" size="sm" onClick={onRerun}>
            Re-run
          </Button>
        ) : null}
        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
      </div>
    </div>
  );
}
