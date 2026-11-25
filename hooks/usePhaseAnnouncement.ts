/**
 * Polite announcement for destination check phase changes.
 *
 * Inputs: the swarm state.
 * Outputs: one short sentence when the check starts, finishes, or fails.
 * Invariants: heartbeats and progress do not trigger announcements; each accepted phase
 * change announces once; the previous phase map updates even when nothing is announced.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import type { SwarmState, WorkerPhase } from "@/lib/swarmReducer";
import { WORKER_IDS } from "@/lib/swarmTypes";

function snapshot(state: SwarmState): Record<string, WorkerPhase> {
  return Object.fromEntries(WORKER_IDS.map((worker) => [worker, state.workers[worker].phase]));
}

/** Returns a sentence for the status area's live region. */
export function usePhaseAnnouncement(state: SwarmState): string {
  const [announcement, setAnnouncement] = useState("");
  const previousRef = useRef<Record<string, WorkerPhase>>(snapshot(state));
  const phases = WORKER_IDS.map((worker) => state.workers[worker].phase).join(",");

  useEffect(() => {
    const next = snapshot(state);
    const previous = previousRef.current;
    previousRef.current = next;
    const changed = WORKER_IDS.find((worker) => previous[worker] !== next[worker]);
    if (changed === undefined) return;
    const phase = next[changed];
    if (phase !== "running" && phase !== "complete" && phase !== "error") return;
    const message =
      phase === "running"
        ? "Destination check started."
        : phase === "complete"
          ? "Destination check finished."
          : "Destination check failed.";
    const timer = setTimeout(() => setAnnouncement(message), 0);
    return () => clearTimeout(timer);
    // The joined phase string is the only input that should announce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phases]);

  return announcement;
}
