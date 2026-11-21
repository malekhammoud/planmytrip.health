/**
 * A one-second clock that only runs while something is live.
 *
 * Inputs: `active`, true while any worker is queued or running.
 * Outputs: epoch milliseconds, or 0 before the first effect and while idle.
 * Invariants: no interval exists while idle, and the first effect supplies the initial
 * time so server rendering never embeds a client clock.
 */

"use client";

import { useEffect, useState } from "react";

/** Returns a ticking time in epoch milliseconds only while `active`. */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!active) return;
    // Defer the first read so the effect never sets state synchronously.
    const first = setTimeout(() => setNow(Date.now()), 0);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [active]);

  return now;
}
