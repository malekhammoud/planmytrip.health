/**
 * Designed pre-run state for the live worker.
 *
 * Inputs: the trip destination and condition.
 * Outputs: one ruled row with the target host, what will be checked, and a disclosure
 * showing the exact goal text sent to the agent.
 * Invariants: no progress, counts, or fake activity appear before a run; every row names
 * a real source and the instruction is the same string the runner sends.
 */

"use client";

import {
  MISSION_WORKERS,
  missionWorkers,
} from "@/components/mission/missionMeta";
import { StatusGlyph } from "@/components/ui";
import { buildWorkerGoal } from "@/lib/swarmGoals";
import type { Condition } from "@/lib/types";

/** Props for {@link PreRun}. */
export interface PreRunProps {
  destination: string;
  condition: Condition;
}

/** One row that explains exactly what will happen. */
export function PreRun({ destination, condition }: PreRunProps) {
  const input = { destination, condition };

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-solid border-hairline pb-2">
        <p className="t-label text-muted">Will check</p>
        <p className="t-data-sm text-muted">{missionWorkers().length} live check</p>
      </div>
      {missionWorkers().map((worker) => {
        const meta = MISSION_WORKERS[worker];
        return (
          <div
            key={worker}
            className="border-b border-solid border-hairline py-4 last:border-b-0"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <StatusGlyph state="queued" label="Ready" />
              <p className="t-heading text-ink">{meta.name}</p>
              <p className="t-data-sm text-muted">{meta.host}</p>
            </div>
            <p className="t-small measure mt-1 text-muted">{meta.checks}</p>
            <details className="mt-2">
              <summary className="inline-flex min-h-11 cursor-pointer items-center t-button text-accent">
                Show instruction
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-frame border border-solid border-hairline bg-sunken p-3 t-data-sm whitespace-pre-wrap text-ink [overflow-wrap:anywhere]">
                {buildWorkerGoal(worker, input)}
              </pre>
            </details>
          </div>
        );
      })}
    </div>
  );
}
