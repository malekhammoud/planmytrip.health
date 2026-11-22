/**
 * Pure mission-stage derivation for the command surface.
 *
 * Inputs: a PlannerState snapshot. Outputs: the current stage, its rail position, the
 * rail step states, phase counts, the agent with the newest line, and the stage
 * vocabulary shared by the command bar and the workspace grid.
 * Invariants: deterministic and side-effect free; the rail position is the single
 * source of truth for the stage; a ready plan always wins; a failed run keeps its rail
 * position so the layout never jumps backward on error.
 */

import type { PlannerAgentState, PlannerState } from "./plannerReducer";
import type { PlannerAgentId } from "./agentTypes";

/** The five mission stages the workspace layout and command bar render. */
export type MissionStage = "starting" | "researching" | "composing" | "ready" | "error";

/** Display vocabulary for one stage. */
export interface StageMeta {
  label: string;
  heading: string;
  copy: string;
}

/** Stage copy. The internal queued token never renders as "Queued". */
export const STAGE_META: Record<MissionStage, StageMeta> = {
  starting: {
    label: "Starting",
    heading: "Starting the team",
    copy: "Seven sessions are opening. The first research line appears in the activity rail.",
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
    copy: "The route is on the map. The safety envelope stays authoritative.",
  },
  error: {
    label: "Needs retry",
    heading: "Planning paused",
    copy: "The run stopped before a plan was ready. Retry the concierge or edit the trip.",
  },
};

/** The four rail steps, in order. */
export const STAGE_RAIL: readonly { id: MissionStage; label: string }[] = [
  { id: "starting", label: "Start" },
  { id: "researching", label: "Research" },
  { id: "composing", label: "Compose" },
  { id: "ready", label: "Ready" },
];

/** One rail step's visual state. */
export type RailState = "done" | "active" | "pending" | "failed";

/** The layout family the workspace grid uses. */
export type SurfaceMode = "forming" | "researching" | "composing" | "ready";

/** Counts agents in one phase. */
export function phaseCount(
  agents: Record<PlannerAgentId, PlannerAgentState>,
  phase: PlannerAgentState["phase"],
): number {
  return Object.values(agents).filter((agent) => agent.phase === phase).length;
}

/** How far the stage rail has advanced; stays put when a run fails. */
export function railPosition(state: PlannerState): number {
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
export function missionStage(state: PlannerState): MissionStage {
  if (state.plan !== null) return "ready";
  if (state.status === "error") return "error";
  if (state.status === "idle") return "starting";
  const position = railPosition(state);
  return position >= 2 ? "composing" : position === 1 ? "researching" : "starting";
}

/** Visual state of one rail step given the position and failure flag. */
export function railState(index: number, position: number, failed: boolean): RailState {
  if (index < position) return "done";
  if (index > position) return "pending";
  return failed ? "failed" : "active";
}

/**
 * The named-area layout the workspace grid uses. Each live stage reorders the same
 * mounted panels: the team leads while sessions open, stage and team sit together
 * while research lands, the stage takes the width while the concierge composes, and
 * the finished stage leads with the team compacted to a strip.
 */
export function surfaceMode(stage: MissionStage): SurfaceMode {
  if (stage === "ready") return "ready";
  if (stage === "composing") return "composing";
  if (stage === "researching") return "researching";
  return "forming";
}

/**
 * The agent whose line arrived most recently, used by the deck to follow live work
 * without inventing a status. Null while the log is empty.
 */
export function newestAgent(state: PlannerState): PlannerAgentId | null {
  const entry = state.log[state.log.length - 1];
  return entry === undefined ? null : entry.agentId;
}

/** Human label for a stage's position on the four-step rail, e.g. "Step 2 of 4". */
export function stagePosition(stage: MissionStage): number {
  const index = STAGE_RAIL.findIndex((step) => step.id === stage);
  return index === -1 ? 0 : index;
}
