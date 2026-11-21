/**
 * Pure SSE frame validation for the concierge planner transport.
 *
 * Inputs: one parsed SseMessage and the reducer dispatch.
 * Outputs: typed PlannerActions plus true only when planner_done was applied.
 * Invariants: unknown events, broken JSON, wrong field types, unknown agent ids, and
 * malformed plans are dropped; a wire plan is rebuilt before it reaches the reducer.
 */

import type { Dispatch } from "react";
import type { SseMessage } from "@/lib/sse";
import { normalizeWirePlan } from "@/lib/agent/agentPlanParse";
import type { PlannerAction } from "@/lib/agent/plannerReducer";
import {
  isPlannerAgentId,
  type PlannerActivityKind,
  type PlannerAgentId,
  type PlannerAgentPhase,
  type PlannerErrorCode,
} from "@/lib/agent/agentTypes";

const PHASES: readonly PlannerAgentPhase[] = [
  "idle",
  "queued",
  "researching",
  "writing",
  "complete",
  "error",
];

const ACTIVITY_KINDS: readonly PlannerActivityKind[] = [
  "search",
  "read",
  "note",
  "tool",
  "error",
];

const ERROR_CODES: readonly PlannerErrorCode[] = [
  "agent_unavailable",
  "invalid_request",
  "invalid_plan",
  "timeout",
  "upstream_error",
];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asMock(value: unknown): true | undefined {
  return value === true ? true : undefined;
}

function asTimestamp(value: unknown): string {
  return typeof value === "string" ? value : new Date().toISOString();
}

function asAgentList(value: unknown): PlannerAgentId[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isPlannerAgentId);
}

function asPhase(value: unknown): PlannerAgentPhase | null {
  return typeof value === "string" &&
    (PHASES as readonly string[]).includes(value)
    ? (value as PlannerAgentPhase)
    : null;
}

function asActivityKind(value: unknown): PlannerActivityKind | null {
  return typeof value === "string" &&
    (ACTIVITY_KINDS as readonly string[]).includes(value)
    ? (value as PlannerActivityKind)
    : null;
}

function asErrorCode(value: unknown): PlannerErrorCode | null {
  return typeof value === "string" &&
    (ERROR_CODES as readonly string[]).includes(value)
    ? (value as PlannerErrorCode)
    : null;
}

/**
 * Validates and applies one frame. Returns true only for planner_done so the
 * transport can tell a complete stream from one that closed early.
 */
export function applyPlannerFrame(
  message: SseMessage,
  dispatch: Dispatch<PlannerAction>,
): boolean {
  const eventName = message.event;
  if (eventName === undefined) return false;
  let raw: unknown;
  try {
    raw = JSON.parse(message.data);
  } catch {
    return false;
  }
  if (!isRecord(raw)) return false;
  const mock = asMock(raw.mock);

  switch (eventName) {
    case "planner_started":
      dispatch({ type: "planner_started", mock });
      return false;

    case "agent_started": {
      const agentId = raw.agentId;
      const sessionId = asText(raw.sessionId);
      if (!isPlannerAgentId(agentId) || sessionId === null) return false;
      dispatch({ type: "agent_started", agentId, sessionId, mock });
      return false;
    }

    case "agent_status": {
      const agentId = raw.agentId;
      const status = asPhase(raw.status);
      if (!isPlannerAgentId(agentId) || status === null) return false;
      dispatch({
        type: "agent_status",
        agentId,
        status,
        ...(typeof raw.message === "string" ? { message: raw.message } : {}),
        mock,
      });
      return false;
    }

    case "agent_activity": {
      const agentId = raw.agentId;
      const kind = asActivityKind(raw.kind);
      const text = asText(raw.text);
      if (!isPlannerAgentId(agentId) || kind === null || text === null) return false;
      dispatch({
        type: "agent_activity",
        agentId,
        kind,
        text,
        ts: asTimestamp(raw.ts),
        mock,
      });
      return false;
    }

    case "agent_result": {
      const agentId = raw.agentId;
      const summary = asText(raw.summary);
      if (!isPlannerAgentId(agentId) || typeof raw.ok !== "boolean" || summary === null) {
        return false;
      }
      dispatch({ type: "agent_result", agentId, ok: raw.ok, summary, mock });
      return false;
    }

    case "plan_ready": {
      const plan = normalizeWirePlan(raw.plan);
      if (plan === null) return false;
      dispatch({
        type: "plan_ready",
        plan,
        completed: asAgentList(raw.completed),
        failed: asAgentList(raw.failed),
        mock: plan.mock ?? mock,
      });
      return false;
    }

    case "planner_error": {
      const code = asErrorCode(raw.code);
      const text = asText(raw.message);
      if (code === null || text === null) return false;
      dispatch({ type: "planner_error", code, message: text, mock });
      return false;
    }

    case "planner_done": {
      dispatch({
        type: "planner_done",
        completed: asAgentList(raw.completed),
        failed: asAgentList(raw.failed),
        mock,
      });
      return true;
    }

    default:
      return false;
  }
}
