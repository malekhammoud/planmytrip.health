"use client";

import type { CSSProperties } from "react";
import { AgentPlanView } from "@/components/AgentPlanView";
import { CachedRecordings, type CachedRecording } from "@/components/CachedRecordings";
import { UpgradeCallout } from "@/components/UpgradeCallout";
import { VenueMissionControl } from "@/components/venue/VenueMissionControl";
import { Button, Callout, LinkButton, Skeleton } from "@/components/ui";
import {
  PLANNER_AGENTS,
  type PlannerAgentId,
  type PlannerAgentPhase,
} from "@/lib/agent/agentTypes";
import type { PlannerAgentState, PlannerState } from "@/lib/agent/plannerReducer";
import type { MissionStage } from "@/lib/agent/plannerStage";
import { STAGE_META } from "@/lib/agent/plannerStage";
import type { TripCaptureContext } from "@/lib/data/types";
import type { UseVenueResearchResult } from "@/hooks/useVenueResearch";
import type { TransportMode } from "@/lib/types";

/** Props for {@link PlanPanel}. */
export interface PlanPanelProps {
  state: PlannerState;
  visible: boolean;
  /** Trip length, so the forming frame shows the real number of day slots. */
  days: number;
  /** Current mission stage; changes the forming copy without changing the plan. */
  stage: MissionStage;
  /** Free-text starting point used by the arrival map link. */
  origin: string;
  /** Travel method used to order stops and choose each leg's mode. */
  transport: TransportMode;
  capture: TripCaptureContext;
  onRetry: () => void;
  /** The day highlighted on the map and in the route, owned by the workspace. */
  activeDay: number | null;
  onSelectDay: (day: number | null) => void;
  /** Recorded worker runs carried by a cached verification. */
  recordings?: readonly CachedRecording[];
  /** Live menu and hotel evidence for this plan. */
  venue: UseVenueResearchResult;
  /** Whether the current plan includes live venue research. */
  venueEnabled: boolean;
  /** Trip start date, used by the hotel-rate note. */
  checkIn: string;
}

const ROUTE_PATH =
  "M 12 112 C 72 104 96 42 158 56 S 240 124 316 94 S 430 30 500 54 S 596 102 628 64";

const ROUTE_NODES: readonly { left: string; top: string }[] = [
  { left: "2%", top: "75%" },
  { left: "25%", top: "37%" },
  { left: "49%", top: "63%" },
  { left: "78%", top: "36%" },
  { left: "98%", top: "43%" },
];

const TICK: Record<PlannerAgentPhase, string> = {
  idle: "bg-hairline",
  queued: "bg-hairline",
  researching: "status-pulse bg-accent",
  writing: "status-pulse bg-accent",
  complete: "bg-ink",
  error: "bg-risk",
};

function completedCount(
  agents: Record<PlannerAgentId, PlannerAgentState>,
): number {
  return Object.values(agents).filter((agent) => agent.phase === "complete").length;
}

/**
 * The live route stage while the plan forms. Seven real phase ticks, the trip's true
 * day slots, and stage copy hold the space. No route or place is invented here.
 */
function RouteForming({
  agents,
  days,
  stage,
}: {
  agents: Record<PlannerAgentId, PlannerAgentState>;
  days: number;
  stage: MissionStage;
}) {
  const completed = completedCount(agents);
  const failing = Object.values(agents).filter((agent) => agent.phase === "error").length;
  const status =
    stage === "composing"
      ? "The concierge is sequencing verified picks inside each day's ceilings."
      : completed >= 7
        ? "All seven agents are in. The concierge is writing the final route."
        : `${completed} of 7 agents complete. The map appears when the route is ready.`;
  const slots = Array.from({ length: Math.min(Math.max(days, 1), 7) }, (_, i) => i + 1);

  return (
    <div className="rounded-frame border border-hairline-strong bg-surface p-4 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="t-label text-muted">Route forming</p>
        <p className="t-data-sm text-muted">
          {completed} / 7 agents{failing > 0 ? ` · ${failing} incomplete` : ""}
        </p>
      </div>
      <p role="status" aria-live="polite" className="t-small mt-1 text-muted">
        {status}
      </p>

      <div className="mt-4 flex items-center gap-1" aria-hidden="true">
        {PLANNER_AGENTS.map((meta) => (
          <span
            key={meta.id}
            className={`block h-1 flex-1 ${TICK[agents[meta.id].phase]}`}
          />
        ))}
      </div>

      <div className="relative mt-6 h-32 w-full" aria-hidden="true">
        <svg
          viewBox="0 0 640 150"
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
        >
          <path
            className="route-forming__base"
            d={ROUTE_PATH}
            vectorEffect="non-scaling-stroke"
          />
          <path
            className="route-forming__route"
            d={ROUTE_PATH}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {ROUTE_NODES.map((node, index) => {
          const style = {
            left: node.left,
            top: node.top,
            "--node-index": index,
          } as CSSProperties;
          return <span key={node.left} className="route-forming__node" style={style} />;
        })}
      </div>

      {days > slots.length ? (
        <p className="t-data-sm mt-4 text-muted">
          Showing the first {slots.length} of {days} day slots.
        </p>
      ) : null}
      <div className="mt-2 grid grid-cols-1 gap-6 border-t border-hairline pt-5 sm:grid-cols-3">
        {slots.map((day) => (
          <div key={day}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="t-label text-muted">Day {String(day).padStart(2, "0")}</p>
              <p className="t-data-sm text-muted">Pending</p>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <Skeleton height={12} width="72%" />
              <Skeleton height={12} width="100%" />
              <Skeleton height={12} width="84%" />
              <Skeleton height={32} width="100%" />
            </div>
          </div>
        ))}
      </div>
      <p className="t-small mt-5 text-muted">
        {STAGE_META[stage].copy} The engine safety envelope is already final.
      </p>
    </div>
  );
}

/** Route and itinerary stage: live skeleton, retry, or the finished agent plan. */
export function PlanPanel({
  state,
  visible,
  days,
  stage,
  origin,
  transport,
  capture,
  onRetry,
  activeDay,
  onSelectDay,
  recordings = [],
  venue,
  venueEnabled,
  checkIn,
}: PlanPanelProps) {
  const mockNote = state.mock ? (
    <div className="mb-4">
      <Callout tone="caution" title="Mock planning data">
        These agents ran in mock mode. The places, prices, and route are sample data.
      </Callout>
    </div>
  ) : null;
  const cachedNote =
    state.cachedAt === null ? null : (
      <div className="mb-4">
        <Callout tone="info" title="Cached plan">
          <p>
            Served from a verified cache checked{" "}
            {new Date(state.cachedAt).toLocaleDateString("en-CA", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
            .{" "}
            {state.cacheMatch === "related"
              ? "The cache matched the destination, duration, and condition; your other preferences and starting point may differ."
              : "The route, places, and sources are the recorded result."}
          </p>
          <p className="mt-2">Confirm hours, prices, and availability before booking.</p>
        </Callout>
      </div>
    );

  if (state.plan !== null) {
    return (
      <div>
        {mockNote}
        {cachedNote}
        <CachedRecordings recordings={recordings} />
        <AgentPlanView
          plan={state.plan}
          visible={visible}
          origin={origin}
          transport={transport}
          capture={capture}
          activeDay={activeDay}
          onSelectDay={onSelectDay}
          venue={venue.evidence}
        />
        {venueEnabled ? (
          <VenueMissionControl
            state={venue.state}
            checkIn={checkIn}
            onRetry={venue.retry}
            mock={state.mock}
          />
        ) : (
          <div className="mt-10">
            <UpgradeCallout feature="Live menus and room rates" />
          </div>
        )}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div>
        {mockNote}
        <Callout
          tone={state.error?.code === "agent_unavailable" ? "caution" : "risk"}
          title="Planning paused"
        >
          <p>{state.error?.message ?? "The concierge did not return a plan."}</p>
          <p className="mt-2">
            The safety envelope and live verification keep running.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={onRetry}>
              Try the concierge again
            </Button>
            <LinkButton href="/pricing" variant="ghost">
              See plans
            </LinkButton>
          </div>
        </Callout>
      </div>
    );
  }

  return (
    <div>
      {mockNote}
      <RouteForming agents={state.agents} days={days} stage={stage} />
    </div>
  );
}
