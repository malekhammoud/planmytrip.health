/**
 * Throttled polite announcement for worker phase changes.
 *
 * Inputs: the swarm state.
 * Outputs: one short sentence about a started, finished, or failed worker, at most once
 * per three seconds.
 * Invariants: heartbeats and progress do not trigger announcements; the previous phase
 * map is updated even when a message is throttled.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import type { SwarmState, WorkerPhase } from "@/lib/swarmReducer";
import { WORKER_IDS } from "@/lib/swarmTypes";
import { MISSION_WORKERS } from "@/components/mission/missionMeta";

function snapshot(state: SwarmState): Record<string, WorkerPhase> {
  return Object.fromEntries(WORKER_IDS.map((worker) => [worker, state.workers[worker].phase]));
}

/** Returns a throttled sentence for the status bar's live region. */
export function usePhaseAnnouncement(state: SwarmState): string {
  const [announcement, setAnnouncement] = useState("");
  const previousRef = useRef<Record<string, WorkerPhase>>(snapshot(state));
  const announcedAtRef = useRef(0);
  const phases = WORKER_IDS.map((worker) => state.workers[worker].phase).join(",");

  useEffect(() => {
    const next = snapshot(state);
    const previous = previousRef.current;
    previousRef.current = next;
    const changed = WORKER_IDS.find((worker) => previous[worker] !== next[worker]);
    if (changed === undefined) return;
    const phase = next[changed];
    if (phase !== "running" && phase !== "complete" && phase !== "error") return;
    const now = Date.now();
    if (now - announcedAtRef.current < 3000) return;
    announcedAtRef.current = now;
    const verb =
      phase === "running" ? "started" : phase === "complete" ? "finished" : "failed";
    const message = `${MISSION_WORKERS[changed].name} ${verb}.`;
    const timer = setTimeout(() => setAnnouncement(message), 0);
    return () => clearTimeout(timer);
    // The joined phase string is the only input that should announce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phases]);

  return announcement;
}
