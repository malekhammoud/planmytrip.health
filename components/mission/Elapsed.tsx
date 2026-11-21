/**
 * Isolated elapsed-time display.
 *
 * Inputs: a start and optional end in epoch milliseconds.
 * Outputs: MM:SS text that ticks once a second only while the run is live.
 * Invariants: the interval belongs to this component, so a clock tick does not redraw
 * the mission control; a frozen end never starts a timer.
 */

"use client";

import { useNow } from "@/hooks/useNow";
import { formatDuration } from "@/components/mission/missionMeta";

/** Props for {@link Elapsed}. */
export interface ElapsedProps {
  startedAt: number | null;
  endedAt: number | null;
  className?: string;
  /** Visible prefix, used by the status bar. */
  prefix?: string;
}

/** Live elapsed time for one worker or the whole swarm. */
export function Elapsed({ startedAt, endedAt, className, prefix }: ElapsedProps) {
  const active = startedAt !== null && endedAt === null;
  const now = useNow(active);
  const end = endedAt ?? now;
  const value = startedAt === null ? 0 : Math.max(0, end - startedAt);

  return (
    <span className={className}>
      {prefix === undefined ? null : `${prefix} `}
      {formatDuration(value)}
    </span>
  );
}
