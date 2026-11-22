/**
 * A run clock that counts only while the run is live.
 *
 * Inputs: `running`, true while the planner stream is active, and the current run
 * token so a retry restarts the clock.
 * Outputs: whole seconds since the running transition, frozen when it ends.
 * Invariants: the interval belongs to this hook; an idle or settled run never ticks;
 * the first read happens inside the effect so server markup carries no client clock.
 */

"use client";

import { useEffect, useRef, useState } from "react";

/** Counts up while the run is live, freezes on completion, and restarts on retry. */
export function useElapsed(running: boolean, runToken = 0): number {
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) {
      startedAtRef.current = null;
      return;
    }
    startedAtRef.current = Date.now();
    const startedAt = startedAtRef.current;
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, runToken]);

  return elapsed;
}
