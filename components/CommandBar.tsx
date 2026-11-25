/**
 * The sticky command bar: trip identity, mission stage, run clocks, live counts, and
 * the trip actions in one instrument row.
 *
 * Inputs: the trip config, planner state, swarm state, and the edit/replan actions.
 * Outputs: a two-row sticky bar with a labelled stage rail, two real progress rules,
 * and a newest-activity line. Every value traces to an accepted event; clocks tick only
 * while a run is live.
 * Invariants: no percentage, ETA, or invented progress; the queued token never renders;
 * the elapsed interval lives in useElapsed and Elapsed, not in this component's render.
 */

"use client";

import { Elapsed } from "@/components/mission/Elapsed";
import { WORKER_TAG, formatDuration } from "@/components/mission/missionMeta";
import { SaveTripButton } from "@/components/SaveTripButton";
import { Button } from "@/components/ui";
import { useElapsed } from "@/hooks/useElapsed";
import {
  BUDGET_LABELS,
  PLANNER_AGENTS,
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
import { CONDITION_LABELS, TRANSPORT_LABELS } from "@/lib/types";
import type { SwarmState } from "@/lib/swarmReducer";
import { mergedFeed, swarmSummary } from "@/lib/swarmTelemetry";
import { WORKER_IDS } from "@/lib/swarmTypes";

/** Props for {@link CommandBar}. */
export interface CommandBarProps {
  trip: TripConfig;
  runId: string;
  plan: AgentTripPlan | null;
  state: PlannerState;
  swarm: SwarmState;
  onEditTrip: () => void;
  onReplan: () => void;
}

const AGENT_NAMES = new Map(PLANNER_AGENTS.map((agent) => [agent.id, agent.name]));

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

/** The newest real activity line across both teams, or null while nothing has arrived. */
function newestLine(
  state: PlannerState,
  swarm: SwarmState,
): { id: string; tag: string; text: string } | null {
  const plannerEntry = state.log[state.log.length - 1];
  const swarmLine = mergedFeed(swarm, "all", 1)[0];
  const plannerAt = plannerEntry === undefined ? 0 : Date.parse(plannerEntry.ts);
  const swarmAt = swarmLine?.at ?? 0;
  if (plannerEntry !== undefined && (Number.isNaN(plannerAt) ? 0 : plannerAt) >= swarmAt) {
    return {
      id: `p-${plannerEntry.id}`,
      tag: AGENT_NAMES.get(plannerEntry.agentId) ?? "Planner",
      text: plannerEntry.text,
    };
  }
  if (swarmLine !== undefined) {
    return { id: `s-${swarmLine.id}`, tag: WORKER_TAG[swarmLine.worker], text: swarmLine.text };
  }
  return null;
}

/** A labelled instrument count: mono value, muted unit. */
function Count({ value, unit, tick }: { value: string; unit: string; tick?: boolean }) {
  return (
    <span className="t-data-sm text-muted">
      <span key={value} className={`${tick ? "anim-tick" : ""} inline-block text-ink`}>
        {value}
      </span>{" "}
      {unit}
    </span>
  );
}

/** Trip identity, stage, clocks, counts, and actions; sticky under the site header. */
export function CommandBar({
  trip,
  runId,
  plan,
  state,
  swarm,
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
  const summary = swarmSummary(swarm);
  const window = swarmWindow(swarm);
  const line = newestLine(state, swarm);
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
              {TRANSPORT_LABELS[trip.transport]} · {BUDGET_LABELS[trip.budget]}
            </p>
          </div>
          <div className="command-actions flex min-w-0 max-w-full flex-wrap items-center gap-2">
            <SaveTripButton key={runId} trip={trip} runId={runId} plan={plan} />
            <Button variant="secondary" onClick={onEditTrip}>
              Edit trip
            </Button>
            <Button variant="secondary" onClick={onReplan}>
              Plan again
            </Button>
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
            Checks{" "}
            <Elapsed
              startedAt={window.startedAt}
              endedAt={window.endedAt}
              className="text-ink"
            />
          </span>
          <Count value={`${completed}/7`} unit="agents" tick />
          {failed > 0 ? (
            <span className="t-data-sm text-risk">{failed} incomplete</span>
          ) : null}
          <span className="hidden sm:inline-flex">
            <Count value={summary.steps.toString()} unit="steps" />
          </span>
          <span className="hidden sm:inline-flex">
            <Count value={summary.sources.toString()} unit="sources" />
          </span>
          <Count value={`${summary.findings}/${WORKER_IDS.length}`} unit="findings" tick />

          {line !== null ? (
            <span
              key={line.id}
              className="anim-fade flex min-w-0 basis-full items-baseline gap-2 lg:basis-64 lg:flex-1"
            >
              <span className="t-label shrink-0 text-muted">{line.tag}</span>
              <span className="t-data-sm truncate text-muted">{line.text}</span>
            </span>
          ) : (
            <span className="t-data-sm flex basis-full text-muted lg:inline lg:flex-1 lg:basis-64">
              Waiting for the first activity line.
            </span>
          )}
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          Stage {meta.label}, step {page + 1} of 4. {completed} of 7 agents complete.
          {failed > 0 ? ` ${failed} incomplete.` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-px bg-hairline">
        <div
          role="progressbar"
          aria-label="Planning agents complete"
          aria-valuemin={0}
          aria-valuemax={7}
          aria-valuenow={completed}
          aria-valuetext={`${completed} of 7 agents complete`}
          className="h-0.5 bg-paper"
        >
          <div
            className="mission-progress__fill h-full bg-accent"
            style={{ width: `${(completed / 7) * 100}%` }}
          />
        </div>
        <div
          role="progressbar"
          aria-label="Verification worker complete"
          aria-valuemin={0}
          aria-valuemax={WORKER_IDS.length}
          aria-valuenow={summary.completed + summary.failed}
          aria-valuetext={`${summary.completed + summary.failed} of ${WORKER_IDS.length} check settled`}
          className="h-0.5 bg-paper"
        >
          <div
            className="mission-progress__fill h-full bg-ink"
            style={{ width: `${((summary.completed + summary.failed) / WORKER_IDS.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
