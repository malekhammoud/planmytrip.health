/**
 * Pure state machine for the concierge planner board.
 *
 * Inputs: run lifecycle, agent activity, and plan actions forwarded by useAgentPlan.
 * Outputs: an immutable PlannerState for PlanWorkspace, PlanPanel, and AgentTeamPanel.
 * Invariants: one run token owns its state; activity is bounded; planner_done never
 * erases a ready plan; malformed frames never reach the reducer.
 */

import {
  PLANNER_AGENT_IDS,
  type AgentTripPlan,
  type PlannerActivityKind,
  type PlannerAgentId,
  type PlannerAgentPhase,
  type PlannerErrorCode,
} from "./agentTypes";

/** One line in the shared planning log. */
export interface PlannerLogEntry {
  id: number;
  agentId: PlannerAgentId;
  kind: PlannerActivityKind;
  text: string;
  ts: string;
}

/** Everything the roster renders for one agent. */
export interface PlannerAgentState {
  phase: PlannerAgentPhase;
  sessionId: string | null;
  activity: readonly string[];
  resultSummary: string | null;
  /** Latest calm phase message from agent_status, cleared when a phase has no copy. */
  message: string | null;
  error: string | null;
}

/** Final completion lists. */
export interface PlannerDoneState {
  completed: readonly PlannerAgentId[];
  failed: readonly PlannerAgentId[];
}

/** Complete reducer state. */
export interface PlannerState {
  runToken: number;
  status: "idle" | "running" | "complete" | "error";
  mock: boolean;
  plan: AgentTripPlan | null;
  done: PlannerDoneState | null;
  error: { code: PlannerErrorCode; message: string } | null;
  agents: Record<PlannerAgentId, PlannerAgentState>;
  log: readonly PlannerLogEntry[];
  nextLogId: number;
}

/** Every transition accepted by plannerReducer. */
export type PlannerAction =
  | { type: "run_started"; runToken: number }
  | { type: "planner_started"; mock?: true }
  | { type: "agent_started"; agentId: PlannerAgentId; sessionId: string; mock?: true }
  | {
      type: "agent_status";
      agentId: PlannerAgentId;
      status: PlannerAgentPhase;
      message?: string;
      mock?: true;
    }
  | {
      type: "agent_activity";
      agentId: PlannerAgentId;
      kind: PlannerActivityKind;
      text: string;
      ts: string;
      mock?: true;
    }
  | {
      type: "agent_result";
      agentId: PlannerAgentId;
      ok: boolean;
      summary: string;
      mock?: true;
    }
  | {
      type: "plan_ready";
      plan: AgentTripPlan;
      completed: readonly PlannerAgentId[];
      failed: readonly PlannerAgentId[];
      mock?: true;
    }
  | {
      type: "planner_error";
      code: PlannerErrorCode;
      message: string;
      mock?: true;
    }
  | {
      type: "planner_done";
      completed: readonly PlannerAgentId[];
      failed: readonly PlannerAgentId[];
      mock?: true;
    }
  | { type: "stream_failed"; message: string };

const ACTIVITY_LIMIT = 4;
const LOG_LIMIT = 24;

function createAgentState(phase: PlannerAgentPhase): PlannerAgentState {
  return {
    phase,
    sessionId: null,
    activity: [],
    resultSummary: null,
    message: null,
    error: null,
  };
}

function createAgentMap(
  phase: PlannerAgentPhase,
): Record<PlannerAgentId, PlannerAgentState> {
  const agents = {} as Record<PlannerAgentId, PlannerAgentState>;
  for (const id of PLANNER_AGENT_IDS) agents[id] = createAgentState(phase);
  return agents;
}

/** Creates the designed empty state. */
export function createPlannerState(runToken = 0): PlannerState {
  return {
    runToken,
    status: "idle",
    mock: false,
    plan: null,
    done: null,
    error: null,
    agents: createAgentMap("idle"),
    log: [],
    nextLogId: 1,
  };
}

/** Creates a queued state for the render between a new token and its effect. */
export function createQueuedPlannerState(runToken: number): PlannerState {
  return {
    ...createPlannerState(runToken),
    status: "running",
    agents: createAgentMap("queued"),
  };
}

function replaceAgent(
  state: PlannerState,
  agentId: PlannerAgentId,
  agent: PlannerAgentState,
): PlannerState {
  return { ...state, agents: { ...state.agents, [agentId]: agent } };
}

function withMock(state: PlannerState, mock: true | undefined): PlannerState {
  return mock === true ? { ...state, mock: true } : state;
}

/** Applies one action without mutating the previous state. */
export function plannerReducer(
  state: PlannerState,
  action: PlannerAction,
): PlannerState {
  switch (action.type) {
    case "run_started":
      return {
        ...createPlannerState(action.runToken),
        status: "running",
        agents: createAgentMap("queued"),
      };

    case "planner_started":
      return withMock({ ...state, status: "running" }, action.mock);

    case "agent_started": {
      const agent = state.agents[action.agentId];
      return withMock(
        replaceAgent(state, action.agentId, {
          ...agent,
          phase: "queued",
          sessionId: action.sessionId,
          error: null,
        }),
        action.mock,
      );
    }

    case "agent_status": {
      const agent = state.agents[action.agentId];
      const message = action.message?.trim() ?? "";
      return withMock(
        replaceAgent(state, action.agentId, {
          ...agent,
          phase: action.status,
          message:
            action.status !== "error" && message.length > 0 ? message : null,
          error:
            action.status === "error"
              ? action.message ?? "This check could not finish."
              : null,
        }),
        action.mock,
      );
    }

    case "agent_activity": {
      const agent = state.agents[action.agentId];
      const text = action.text.trim();
      if (text.length === 0) return state;
      const entry: PlannerLogEntry = {
        id: state.nextLogId,
        agentId: action.agentId,
        kind: action.kind,
        text,
        ts: action.ts,
      };
      return withMock(
        {
          ...replaceAgent(state, action.agentId, {
            ...agent,
            activity: [...agent.activity, text].slice(-ACTIVITY_LIMIT),
          }),
          log: [...state.log, entry].slice(-LOG_LIMIT),
          nextLogId: state.nextLogId + 1,
        },
        action.mock,
      );
    }

    case "agent_result": {
      const agent = state.agents[action.agentId];
      return withMock(
        replaceAgent(state, action.agentId, {
          ...agent,
          phase: action.ok ? "complete" : "error",
          resultSummary: action.summary,
          message: null,
          error: action.ok ? null : action.summary,
        }),
        action.mock,
      );
    }

    case "plan_ready":
      return withMock(
        {
          ...state,
          status: "complete",
          plan: action.plan,
          done: { completed: action.completed, failed: action.failed },
          error: null,
        },
        action.mock,
      );

    case "planner_error":
      return withMock(
        {
          ...state,
          status: "error",
          error: { code: action.code, message: action.message },
        },
        action.mock,
      );

    case "planner_done":
      return withMock(
        {
          ...state,
          status: state.plan === null ? "error" : "complete",
          done: { completed: action.completed, failed: action.failed },
        },
        action.mock,
      );

    case "stream_failed":
      return {
        ...state,
        status: "error",
        error: { code: "upstream_error", message: action.message },
      };
  }
}
