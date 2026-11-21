/**
 * Connection dot and silence copy for one worker.
 *
 * Inputs: a WorkerState and an optional retry action.
 * Outputs: an 8px dot that ticks on each real heartbeat, plus quiet or stalled copy.
 * Invariants: the dot only moves when a heartbeat arrives; silence is named, never
 * masked; a stalled stream offers Retry, a quiet one only reports the silence.
 */

"use client";

import { Button } from "@/components/ui";
import { useNow } from "@/hooks/useNow";
import type { WorkerState } from "@/lib/swarmReducer";
import { connectionHealth } from "@/lib/swarmTelemetry";

/** Props for {@link ConnectionStatus}. */
export interface ConnectionStatusProps {
  state: WorkerState;
  onRetry?: () => void;
  /** Hides the text line and keeps only the dot, for dense tiles. */
  dotOnly?: boolean;
}

const DOT_CLASS = {
  live: "bg-accent",
  quiet: "bg-caution-bar",
  stalled: "bg-risk",
} as const;

/** Live, quiet, or stalled, derived only from the last accepted event. */
export function ConnectionStatus({ state, onRetry, dotOnly = false }: ConnectionStatusProps) {
  const active = state.phase === "queued" || state.phase === "running";
  const now = useNow(active);
  const health = connectionHealth(state.lastEventAt, now);
  const showText = !dotOnly && active && health !== "live" && now > 0;

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span
        key={state.heartbeat.count}
        aria-hidden="true"
        className={[
          "block h-2 w-2 shrink-0",
          active ? DOT_CLASS[health] : "bg-hairline-strong",
          active && state.heartbeat.count > 0 ? "anim-tick" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      />
      {showText ? (
        <span className="t-small text-caution">
          {health === "stalled" ? "Stream stalled" : "No activity for 15s"}
          {health === "stalled" && onRetry !== undefined ? (
            <Button variant="ghost" size="sm" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
