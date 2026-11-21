"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { PlannerAgentState, PlannerState } from "@/lib/agent/plannerReducer";
import type { PlannerAgentId } from "@/lib/agent/agentTypes";

type MissionStage = "starting" | "researching" | "composing" | "ready" | "error";

interface StageMeta {
  label: string;
  heading: string;
  copy: string;
}

const STAGE_META: Record<MissionStage, StageMeta> = {
  starting: {
    label: "Starting",
    heading: "Starting the team",
    copy: "Seven sessions are opening. The first research line appears below.",
  },
  researching: {
    label: "Researching",
    heading: "Researching live sources",
    copy: "Six specialists are reading live sources. The concierge waits for verified picks.",
  },
  composing: {
    label: "Composing",
    heading: "Composing the route",
    copy: "The concierge is sequencing verified picks inside each day's step and walking ceilings.",
  },
  ready: {
    label: "Ready",
    heading: "Plan ready",
    copy: "The route is ready. The safety envelope below stays authoritative.",
  },
  error: {
    label: "Needs retry",
    heading: "Planning paused",
    copy: "The run stopped before a plan was ready. Retry the concierge or edit the trip.",
  },
};

const RAIL: readonly { id: MissionStage; label: string }[] = [
  { id: "starting", label: "Start" },
  { id: "researching", label: "Research" },
  { id: "composing", label: "Compose" },
  { id: "ready", label: "Ready" },
];

type RailState = "done" | "active" | "pending" | "failed";

const RAIL_CLASSES: Record<RailState, { border: string; dot: string; label: string }> = {
  done: { border: "border-ink", dot: "bg-ink", label: "text-ink" },
  active: { border: "border-accent", dot: "bg-accent", label: "text-ink" },
  pending: {
    border: "border-hairline",
    dot: "border border-solid border-hairline-strong",
    label: "text-muted",
  },
  failed: { border: "border-risk", dot: "bg-risk", label: "text-risk" },
};

function revealStyle(index: number): CSSProperties {
  return { "--reveal-index": index } as CSSProperties;
}

function phaseCount(
  agents: Record<PlannerAgentId, PlannerAgentState>,
  phase: PlannerAgentState["phase"],
): number {
  return Object.values(agents).filter((agent) => agent.phase === phase).length;
}

/** How far the stage rail has advanced; stays put when a run fails. */
function railPosition(state: PlannerState): number {
  if (state.plan !== null) return 3;
  const agents = Object.values(state.agents);
  if (
    state.agents.concierge.sessionId !== null ||
    agents.some((agent) => agent.phase === "writing")
  ) {
    return 2;
  }
  if (
    agents.some(
      (agent) =>
        agent.sessionId !== null ||
        agent.phase === "researching" ||
        agent.phase === "complete" ||
        agent.phase === "error",
    )
  ) {
    return 1;
  }
  return 0;
}

/** Current mission stage; the rail position is the single source of truth. */
function missionStage(state: PlannerState): MissionStage {
  if (state.plan !== null) return "ready";
  if (state.status === "error") return "error";
  if (state.status === "idle") return "starting";
  const position = railPosition(state);
  return position >= 2 ? "composing" : position === 1 ? "researching" : "starting";
}

function railState(index: number, position: number, failed: boolean): RailState {
  if (index < position) return "done";
  if (index > position) return "pending";
  return failed ? "failed" : "active";
}

function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const body = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${body}` : body;
}

/** Counts up while the run is live and freezes on completion or failure. */
function useElapsed(running: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    if (startedAtRef.current === null) startedAtRef.current = Date.now();
    const timer = window.setInterval(() => {
      const startedAt = startedAtRef.current;
      if (startedAt !== null) {
        setElapsed(Math.floor((Date.now() - startedAt) / 1000));
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  return elapsed;
}

/** Live mission band: stage, elapsed time, agent progress, and the stage rail. */
export function MissionBand({ state }: { state: PlannerState }) {
  const stage = missionStage(state);
  const meta = STAGE_META[stage];
  const completed = phaseCount(state.agents, "complete");
  const failed = phaseCount(state.agents, "error");
  const position = railPosition(state);
  const running = state.status === "running";
  const elapsed = useElapsed(running);

  return (
    <section
      aria-labelledby="mission-heading"
      className="reveal-section mt-10 border-t border-hairline-strong pt-6"
      style={revealStyle(1)}
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="t-label text-muted">Mission</p>
            <span
              aria-hidden="true"
              className={`h-2 w-2 ${
                running
                  ? "status-pulse bg-accent"
                  : stage === "error"
                    ? "bg-risk"
                    : "bg-ink"
              }`}
            />
            <p className="t-label text-muted">Stage · {meta.label}</p>
          </div>
          <h2 id="mission-heading" className="t-title mt-2">
            {meta.heading}
          </h2>
          <p className="t-small measure mt-2 text-muted">{meta.copy}</p>
        </div>

        <dl className="grid grid-cols-2 gap-6 lg:gap-10">
          <div>
            <dt className="t-label text-muted">Elapsed</dt>
            <dd
              role="timer"
              aria-label="Mission elapsed time"
              className="t-data mt-1 text-ink"
            >
              {formatElapsed(elapsed)}
            </dd>
          </div>
          <div>
            <dt className="t-label text-muted">Agents complete</dt>
            <dd className="t-data mt-1 text-ink">{completed} / 7</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6">
        <div
          role="progressbar"
          aria-label="Concierge agents complete"
          aria-valuemin={0}
          aria-valuemax={7}
          aria-valuenow={completed}
          aria-valuetext={`${completed} of 7 agents complete`}
          className="h-0.5 w-full bg-hairline"
        >
          <div
            className="mission-progress__fill h-full bg-accent"
            style={{ width: `${(completed / 7) * 100}%` }}
          />
        </div>
        <ol className="mt-4 grid grid-cols-4 gap-2" aria-label="Planning stages">
          {RAIL.map((step, index) => {
            const current = railState(index, position, stage === "error");
            const classes = RAIL_CLASSES[current];
            return (
              <li
                key={step.id}
                aria-current={index === position ? "step" : undefined}
                className={`border-t pt-3 transition-colors duration-150 ${classes.border}`}
              >
                <span
                  aria-hidden="true"
                  className={`block h-2 w-2 transition-colors duration-150 ${classes.dot} ${
                    current === "active" && running ? "status-pulse" : ""
                  }`}
                />
                <span
                  className={`t-label mt-2 block transition-colors duration-150 ${classes.label}`}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="sr-only" role="status" aria-live="polite">
          Stage {meta.label}. {completed} of 7 agents complete.
          {failed > 0 ? ` ${failed} incomplete.` : ""}
        </p>
      </div>
    </section>
  );
}
