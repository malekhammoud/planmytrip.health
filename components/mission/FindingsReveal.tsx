/**
 * Findings area for the completed destination check.
 *
 * Inputs: the swarm state and the worker id.
 * Outputs: typed DataRow findings with the source link and retrieved time.
 * Invariants: findings exist only after COMPLETE; no partial list, raw JSON, or parse text
 * is fabricated; the stale caution lives in the parent, so findings stay fully legible.
 */

"use client";

import { WorkerFindings } from "@/components/WorkerFindings";
import type { SwarmState } from "@/lib/swarmReducer";
import type { WorkerId } from "@/lib/swarmTypes";

/** Props for {@link FindingsReveal}. */
export interface FindingsRevealProps {
  state: SwarmState;
  worker: WorkerId;
}

/** Completed findings with provenance. */
export function FindingsReveal({ state, worker }: FindingsRevealProps) {
  const value = state.workers[worker];
  if (value.findings === null) return null;

  return <WorkerFindings worker={worker} state={value} reveal />;
}
