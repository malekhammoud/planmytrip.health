/**
 * The persistent activity rail: planning signal and verification feed in one column.
 *
 * Inputs: the planner state and the swarm state.
 * Outputs: a stream switch, a follow/pin line, the planning signal graph and ticker,
 * and the workers' real activity feed. Both feeds stay mounted; only one is shown.
 * Invariants: every line traces to an accepted event; heartbeats never appear; the rail
 * follows the live stream unless the reader pins one; nothing ticks while both are idle.
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { AgentActivityFeed } from "@/components/AgentActivityFeed";
import { ActivityFeed } from "@/components/mission/ActivityFeed";
import type { PlannerState } from "@/lib/agent/plannerReducer";
import type { SwarmState } from "@/lib/swarmReducer";
import { isSwarmLive, mergedFeed } from "@/lib/swarmTelemetry";

type RailStream = "planning" | "checks";

/** Props for {@link LiveRail}. */
export interface LiveRailProps {
  state: PlannerState;
  swarm: SwarmState;
}

function lastPlannerAt(state: PlannerState): number {
  const entry = state.log[state.log.length - 1];
  if (entry === undefined) return 0;
  const at = Date.parse(entry.ts);
  return Number.isNaN(at) ? 0 : at;
}

function lastCheckAt(swarm: SwarmState): number {
  const line = mergedFeed(swarm, "all", 1)[0];
  return line?.at ?? 0;
}

/** One sticky column of real telemetry beside the main stage. */
export function LiveRail({ state, swarm }: LiveRailProps) {
  const plannerLive = state.status === "running";
  const checksLive = isSwarmLive(swarm);
  const checks = mergedFeed(swarm, "all").length;
  const auto: RailStream =
    plannerLive && !checksLive
      ? "planning"
      : checksLive && !plannerLive
        ? "checks"
        : lastCheckAt(swarm) > lastPlannerAt(state)
          ? "checks"
          : state.plan !== null && checks > 0
            ? "checks"
            : "planning";
  const [pinned, setPinned] = useState<RailStream | null>(null);
  const active = pinned ?? auto;
  const live = plannerLive || checksLive;
  const following = pinned === null;

  return (
    <div className="live-rail">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-solid border-ink pt-3">
        <h2 id="rail-heading" className="t-label text-muted">
          Live activity
        </h2>
        <p className="t-data-sm text-muted">
          {live ? "Streaming" : "Settled"} · {checks} check lines
        </p>
      </div>

      <div
        role="group"
        aria-label="Choose the activity stream"
        className="mt-3 grid grid-cols-2 gap-2"
      >
        <Button
          variant={active === "planning" ? "primary" : "secondary"}
          aria-pressed={active === "planning"}
          onClick={() => setPinned("planning")}
          fullWidth
        >
          Planning · {state.log.length}
        </Button>
        <Button
          variant={active === "checks" ? "primary" : "secondary"}
          aria-pressed={active === "checks"}
          onClick={() => setPinned("checks")}
          fullWidth
        >
          Checks · {checks}
        </Button>
      </div>

      <div className="mt-2 flex min-h-6 flex-wrap items-center justify-between gap-2">
        <p className="t-data-sm text-muted">
          {following
            ? `Following the ${active === "planning" ? "planning" : "verification"} stream`
            : `Pinned to ${active === "planning" ? "planning" : "verification"}`}
        </p>
        {following ? null : (
          <Button variant="ghost" size="sm" onClick={() => setPinned(null)}>
            Follow live
          </Button>
        )}
      </div>

      <div hidden={active !== "planning"}>
        <AgentActivityFeed log={state.log} live={plannerLive} />
      </div>
      <div hidden={active !== "checks"}>
        <ActivityFeed state={swarm} />
      </div>
    </div>
  );
}
