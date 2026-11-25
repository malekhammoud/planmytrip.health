/**
 * The sticky command bar: trip identity, stage, run clocks, specialist progress, and
 * the trip actions in one instrument row.
 *
 * Inputs: the trip config, planner state, swarm state, entitlements, and the
 * edit/replan actions.
 * Outputs: a two-row sticky bar with a labelled stage rail, two real progress rules,
 * and a calm action group. Every value traces to an accepted event; clocks tick only
 * while a run is live.
 * Invariants: no percentage, ETA, or invented progress; the queued token never renders;
 * the elapsed interval lives in useElapsed and Elapsed, not in this component's render.
 */

"use client";

import { Elapsed } from "@/components/mission/Elapsed";
import { formatDuration } from "@/components/mission/missionMeta";
import { SaveTripButton } from "@/components/SaveTripButton";
import { Button } from "@/components/ui";
import { useElapsed } from "@/hooks/useElapsed";
import {
  BUDGET_LABELS,
  PLANNER_AGENT_IDS,
  type AgentTripPlan,
  type TripConfig,
} from "@/lib/agent/agentTypes";
import {
  STAGE_META,
  STAGE_RAIL,
  missionStage,
  phaseCount,
  railPosition,
  railState,
  stagePosition,
} from "@/lib/agent/plannerStage";
import type { PlannerState } from "@/lib/agent/plannerReducer";
import { planLabel, type BillingEntitlements } from "@/lib/billing/plans";
import { CONDITION_LABELS, TRANSPORT_LABELS } from "@/lib/types";
import type { SwarmState } from "@/lib/swarmReducer";
import { WORKER_IDS } from "@/lib/swarmTypes";

/** Props for {@link CommandBar}. */
export interface CommandBarProps {
  trip: TripConfig;
  runId: string;
  plan: AgentTripPlan | null;
  state: PlannerState;
  swarm: SwarmState;
  entitlements: BillingEntitlements;
  onEditTrip: () => void;
  onReplan: () => void;
}

const RULE: Record<string, string> = {
  done: "border-ink",
  active: "border-accent",
  pending: "border-hairline",
  failed: "border-risk",
};

const LABEL_TONE: Record<string, string> = {
  done: "text-muted",
  active: "text-ink",
  pending: "text-muted",
  failed: "text-risk",
};

function swarmWindow(state: SwarmState): { startedAt: number | null; endedAt: number | null } {
  let startedAt: number | null = null;
  let endedAt: number | null = null;
  let live = false;
  for (const worker of WORKER_IDS) {
    const value = state.workers[worker];
    if (value.startedAt !== null) {
      startedAt = startedAt === null ? value.startedAt : Math.min(startedAt, value.startedAt);
    }
    if (value.phase === "queued" || value.phase === "running") live = true;
    if (value.endedAt !== null) {
      endedAt = endedAt === null ? value.endedAt : Math.max(endedAt, value.endedAt);
    }
  }
  return { startedAt, endedAt: live ? null : endedAt };
}

/** The plan's live-plan allowance, without inventing a remaining count. */
export function livePlanAllowance(entitlements: BillingEntitlements): string {
  const count = entitlements.tripsPerPeriod;
  const period = entitlements.tripPeriod === "month" ? "month" : "year";
  return `${planLabel(entitlements.plan)} · ${count} live ${
    count === 1 ? "plan" : "plans"
  } a ${period}`;
}

/** Trip identity, stage, clocks, specialists, and actions; sticky under the site header. */
export function CommandBar({
  trip,
  runId,
  plan,
  state,
  swarm,
  entitlements,
  onEditTrip,
  onReplan,
}: CommandBarProps) {
  const stage = missionStage(state);
  const meta = STAGE_META[stage];
  const position = railPosition(state);
  const page = stagePosition(stage);
  const running = state.status === "running";
  const elapsed = useElapsed(running, state.runToken);
  const completed = phaseCount(state.agents, "complete");
  const failed = phaseCount(state.agents, "error");
  const total = PLANNER_AGENT_IDS.length;
  const checks = swarmWindow(swarm);
  const checkSettled = WORKER_IDS.filter((worker) => {
    const phase = swarm.workers[worker].phase;
    return phase === "complete" || phase === "error";
  }).length;
  const dot = running
    ? "status-pulse bg-accent"
    : stage === "error"
      ? "bg-risk"
      : stage === "ready"
        ? "bg-ink"
        : "bg-hairline-strong";

  return (
    <div
      className="sticky top-16 z-20 border-b border-solid border-hairline-strong bg-paper"
      data-stage={stage}
    >
      <div className="page-container flex flex-col gap-1.5 py-2">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="min-w-0 flex-1 basis-52">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
              <h1 className="t-heading truncate text-ink">{trip.destination}</h1>
              <span className="t-label shrink-0 text-muted">
                {plan === null ? `Step ${page + 1} of 4` : `${plan.days.length} day plan`}
              </span>
            </div>
            <p className="t-data-sm hidden truncate text-muted sm:block">
              {trip.days} days · {CONDITION_LABELS[trip.condition]} ·{" "}
              {TRANSPORT_LABELS[trip.transport]} · {BUDGET_LABELS[trip.budget]} ·{" "}
              {livePlanAllowance(entitlements)}
            </p>
          </div>
          <div className="command-actions flex min-w-0 max-w-full flex-wrap items-center gap-2">
            <SaveTripButton key={runId} trip={trip} runId={runId} plan={plan} />
            <Button variant="secondary" onClick={onEditTrip}>
              Edit trip
            </Button>
            <Button
              variant="secondary"
              onClick={onReplan}
              title="Starts a new live plan"
            >
              Re-run plan
            </Button>
            <p className="t-data-sm basis-full text-right text-muted">
              Re-run plan starts a new live plan.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className={`block h-2 w-2 shrink-0 ${dot}`} />
            <span key={stage} className="t-label anim-fade text-ink">
              {meta.label}
            </span>
            {running ? <span className="t-label text-accent">Live</span> : null}
          </span>

          <ol className="hidden items-center gap-x-3 md:flex" aria-hidden="true">
            {STAGE_RAIL.map((step, index) => {
              const stateOf = railState(index, position, stage === "error");
              return (
                <li key={step.id} className="flex items-center gap-1.5">
                  <span
                    className={`block h-0 w-5 border-t-2 border-solid transition-colors duration-150 ${
                      RULE[stateOf] ?? "border-hairline"
                    }`}
                  />
                  <span className={`t-label ${LABEL_TONE[stateOf] ?? "text-muted"}`}>
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>

          <span className="t-data-sm text-muted">
            Plan{" "}
            <span role="timer" aria-label="Planning elapsed time" className="text-ink">
              {formatDuration(elapsed * 1000)}
            </span>
          </span>
          <span className="t-data-sm text-muted">
            Check{" "}
            <Elapsed
              startedAt={checks.startedAt}
              endedAt={checks.endedAt}
              className="text-ink"
            />
          </span>
          <span className="t-data-sm text-muted">
            <span key={completed} className="anim-tick inline-block text-ink">
              {completed}/{total}
            </span>{" "}
            specialists
          </span>
          {failed > 0 ? (
            <span className="t-data-sm text-risk">{failed} incomplete</span>
          ) : null}
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          Stage {meta.label}, step {page + 1} of 4. {completed} of {total} specialists
          complete.
          {failed > 0 ? ` ${failed} incomplete.` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-px bg-hairline">
        <div
          role="progressbar"
          aria-label="Specialists complete"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={completed}
          aria-valuetext={`${completed} of ${total} specialists complete`}
          className="h-0.5 bg-paper"
        >
          <div
            className="mission-progress__fill h-full bg-accent"
            style={{ width: `${(completed / total) * 100}%` }}
          />
        </div>
        <div
          role="progressbar"
          aria-label="Destination check complete"
          aria-valuemin={0}
          aria-valuemax={WORKER_IDS.length}
          aria-valuenow={checkSettled}
          aria-valuetext={`${checkSettled} of ${WORKER_IDS.length} destination check settled`}
          className="h-0.5 bg-paper"
        >
          <div
            className="mission-progress__fill h-full bg-ink"
            style={{ width: `${(checkSettled / WORKER_IDS.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
