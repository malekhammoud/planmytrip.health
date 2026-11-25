/**
 * Findings area for completed workers.
 *
 * Inputs: the swarm state and a dim flag for stale runs.
 * Outputs: typed DataRow lists and raw JSON for each worker that returned findings.
 * Invariants: findings exist only after COMPLETE; no partial list is fabricated; rows
 * arrive with a 60ms stagger, and stale findings are visibly dimmed.
 */

"use client";

import { WorkerFindings } from "@/components/WorkerFindings";
import {
  MISSION_WORKERS,
  PHASE_LABEL,
  formatRetrievedAt,
} from "@/components/mission/missionMeta";
import type { SwarmState } from "@/lib/swarmReducer";
import { WORKER_IDS, type WorkerId } from "@/lib/swarmTypes";

/** Props for {@link FindingsReveal}. */
export interface FindingsRevealProps {
  state: SwarmState;
  /** Dims the old findings after the trip inputs changed. */
  dimmed?: boolean;
  /** When set, only this worker's findings appear; the tiles choose it. */
  worker?: WorkerId;
}

/** Completed findings, in canonical worker order, with provenance. */
export function FindingsReveal({ state, dimmed = false, worker }: FindingsRevealProps) {
  const completed = (worker === undefined ? WORKER_IDS : [worker]).filter(
    (id) => state.workers[id].findings !== null,
  );

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-solid border-hairline pb-2">
        <p className="t-label text-muted">
          Findings{worker === undefined ? "" : ` · ${MISSION_WORKERS[worker].name}`}
        </p>
        <p className="t-data-sm text-muted">{completed.length} of {WORKER_IDS.length}</p>
      </div>
      {completed.length === 0 ? (
        <p className="t-small py-4 text-muted">
          {worker === undefined
            ? "Findings appear only when a worker completes."
            : `No findings yet for ${MISSION_WORKERS[worker].name}. They appear only when that check completes.`}
        </p>
      ) : (
        <div className={dimmed ? "opacity-45" : undefined}>
          {completed.map((worker) => {
            const value = state.workers[worker];
            return (
              <div
                key={worker}
                className="border-b border-solid border-hairline py-4 last:border-b-0"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="t-heading text-ink">{MISSION_WORKERS[worker].name}</p>
                  <p className="t-data-sm text-muted">
                    {PHASE_LABEL[value.phase]} · {formatRetrievedAt(value.retrievedAt)}
                  </p>
                </div>
                <WorkerFindings worker={worker} state={value} reveal />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
