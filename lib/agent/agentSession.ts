/**
 * OpenCode session mechanics for the concierge team.
 *
 * Inputs: an OpenCode client, a temp workspace, one agent id and prompt, and the run
 * context. Outputs: typed session events, activity lines, settlements, and the final
 * assistant transcript.
 * Invariants: every session has a timeout; one agent cannot throw out of its own run;
 * the configured model is passed explicitly; reasoning is never streamed; the tool name
 * map only holds in-flight call ids.
 */

import type { OpenCodeClient } from "@opencode/client";
import { buildHealthTripPlan } from "@/lib/healthTripEngine";
import { plannerModelConfig } from "./agentConfig";
import { noteFromDelta, toolActivity } from "./agentEvents";
import { collectAssistantText, isRecord } from "./agentParse";
import type {
  AgentActivityPayload,
  PlannerAgentId,
  PlannerAgentPhase,
  PlannerCapInput,
  PlannerEvent,
  PlannerRequest,
} from "./agentTypes";

/** Per-specialist research budget. */
export const SPECIALIST_TIMEOUT_MS = 420_000;

/** Lead-concierge synthesis budget. */
export const CONCIERGE_TIMEOUT_MS = 300_000;

const NOTE_INTERVAL_MS = 1_600;

/** One run's emit callback and cancellation signal. */
export interface PlannerRunContext {
  emit: (event: PlannerEvent) => void;
  signal: AbortSignal;
}

interface OpenCodeEventLike {
  type: string;
  data?: unknown;
}

/** Why one session stopped. */
export interface AgentSettlement {
  ok: boolean;
  reason: "complete" | "timeout" | "failed" | "aborted";
}

/** One agent's live session and settlement state. */
export interface LiveAgent {
  id: PlannerAgentId;
  sessionID: string | null;
  promise: Promise<AgentSettlement>;
  settle: (settlement: AgentSettlement) => void;
  settled: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  toolNames: Map<string, string>;
  lastNoteAt: number;
  /** True when the provider rejected the run for quota or rate limits. */
  quota: boolean;
}

/** ISO clock used by every planner payload. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Emits one calm phase change. */
export function emitStatus(
  context: PlannerRunContext,
  agentId: PlannerAgentId,
  status: PlannerAgentPhase,
  message?: string,
): void {
  context.emit({
    event: "agent_status",
    data: { agentId, status, ts: nowIso(), ...(message ? { message } : {}) },
  });
}

/** Emits one bounded activity line. */
export function emitActivity(
  context: PlannerRunContext,
  agentId: PlannerAgentId,
  activity: { kind: AgentActivityPayload["kind"]; text: string },
): void {
  context.emit({
    event: "agent_activity",
    data: { agentId, kind: activity.kind, text: activity.text, ts: nowIso() },
  });
}

/** Emits one specialist result summary. */
export function emitResult(
  context: PlannerRunContext,
  agentId: PlannerAgentId,
  ok: boolean,
  summary: string,
): void {
  context.emit({
    event: "agent_result",
    data: { agentId, ok, summary, ts: nowIso() },
  });
}

/** Creates an idle live-agent shell with a single-settlement promise. */
export function createAgent(id: PlannerAgentId): LiveAgent {
  const agent: LiveAgent = {
    id,
    sessionID: null,
    promise: Promise.resolve({ ok: false, reason: "failed" }),
    settle: () => {},
    settled: false,
    timer: null,
    toolNames: new Map(),
    lastNoteAt: 0,
    quota: false,
  };
  let settleFn: (settlement: AgentSettlement) => void = () => {};
  agent.promise = new Promise<AgentSettlement>((resolve) => {
    settleFn = resolve;
  });
  agent.settle = (settlement) => {
    if (agent.settled) return;
    agent.settled = true;
    if (agent.timer !== null) clearTimeout(agent.timer);
    settleFn(settlement);
  };
  return agent;
}

function sessionIdOf(event: OpenCodeEventLike): string | null {
  if (!isRecord(event.data)) return null;
  return typeof event.data.sessionID === "string" ? event.data.sessionID : null;
}

/** Routes one OpenCode event into roster status, activity, and settlement. */
export function handleAgentEvent(
  event: OpenCodeEventLike,
  bySession: ReadonlyMap<string, LiveAgent>,
  context: PlannerRunContext,
): void {
  const sessionID = sessionIdOf(event);
  if (sessionID === null) return;
  const agent = bySession.get(sessionID);
  if (agent === undefined) return;
  const data = isRecord(event.data) ? event.data : {};
  switch (event.type) {
    case "session.execution.started":
      emitStatus(context, agent.id, "researching");
      return;
    case "session.tool.input.started": {
      const name = typeof data.name === "string" ? data.name : "";
      const id = typeof data.id === "string" ? data.id : null;
      if (id !== null && name !== "") agent.toolNames.set(id, name);
      return;
    }
    case "session.tool.called": {
      const id = typeof data.id === "string" ? data.id : null;
      const name = id === null ? "" : agent.toolNames.get(id) ?? "";
      const input = isRecord(data.input) ? data.input : {};
      emitActivity(context, agent.id, toolActivity(name, input));
      emitStatus(context, agent.id, "researching");
      return;
    }
    case "session.tool.failed":
      emitActivity(context, agent.id, {
        kind: "error",
        text: "A source could not be read. Trying another route.",
      });
      return;
    case "session.retry.scheduled":
      emitActivity(context, agent.id, {
        kind: "note",
        text: "The model is retrying a slow request.",
      });
      return;
    case "session.text.delta": {
      if (typeof data.delta !== "string") return;
      const now = Date.now();
      if (now - agent.lastNoteAt < NOTE_INTERVAL_MS) return;
      const note = noteFromDelta(data.delta);
      if (note === null) return;
      agent.lastNoteAt = now;
      emitActivity(context, agent.id, { kind: "note", text: note });
      return;
    }
    case "session.execution.succeeded":
      emitStatus(context, agent.id, "writing");
      agent.settle({ ok: true, reason: "complete" });
      return;
    case "session.execution.failed": {
      const failure = isRecord(data.error) ? data.error : {};
      const type = typeof failure.type === "string" ? failure.type : "";
      agent.quota =
        /quota|free-limit|rate/i.test(type) || failure.status === 429;
      agent.settle({ ok: false, reason: "failed" });
      return;
    }
    case "session.idle":
      // Some providers end a run without a separate succeeded frame.
      agent.settle({ ok: true, reason: "complete" });
      return;
    default:
      return;
  }
}

/**
 * Creates one OpenCode session, prompts it, and waits for its terminal event. A timeout
 * or provider failure returns null; the caller decides whether the plan can continue.
 */
export async function runAgent(
  client: OpenCodeClient,
  directory: string,
  agentId: PlannerAgentId,
  prompt: string,
  timeoutMs: number,
  context: PlannerRunContext,
  byId: ReadonlyMap<PlannerAgentId, LiveAgent>,
  bySession: Map<string, LiveAgent>,
): Promise<string | null> {
  const agent = byId.get(agentId);
  if (agent === undefined) return null;
  const configuredModel = plannerModelConfig();
  let sessionID: string;
  try {
    const session = await client.session.create({
      location: { directory },
      agent: agentId,
      title: `PlanMyTrip ${agentId}: ${prompt.slice(0, 60)}`,
      ...(configuredModel === null
        ? {}
        : {
            model: {
              id: configuredModel.model,
              providerID: configuredModel.providerID,
              ...(configuredModel.variant === undefined
                ? {}
                : { variant: configuredModel.variant }),
            },
          }),
    });
    sessionID = session.id;
  } catch {
    emitStatus(context, agentId, "error", "The agent could not start.");
    return null;
  }
  agent.sessionID = sessionID;
  bySession.set(sessionID, agent);
  context.emit({
    event: "agent_started",
    data: { agentId, sessionId: sessionID, ts: nowIso() },
  });
  agent.timer = setTimeout(() => {
    agent.settle({ ok: false, reason: "timeout" });
  }, timeoutMs);

  try {
    await client.session.prompt({ sessionID, text: prompt });
  } catch {
    agent.settle({ ok: false, reason: "failed" });
  }

  const outcome = await agent.promise;
  if (!outcome.ok) {
    if (outcome.reason === "timeout") {
      emitStatus(context, agentId, "error", "Timed out while researching.");
    } else if (outcome.reason !== "aborted") {
      emitStatus(context, agentId, "error", "This check could not finish.");
    }
    await client.session.interrupt({ sessionID }).catch(() => {});
    return null;
  }

  try {
    const messages = await client.message.list({ sessionID });
    const text = collectAssistantText(messages.data);
    if (text.length === 0) {
      emitStatus(context, agentId, "error", "The agent returned no result.");
      return null;
    }
    return text;
  } catch {
    emitStatus(context, agentId, "error", "The agent result could not be read.");
    return null;
  }
}

/** Builds the engine's day ceilings for the concierge prompt and plan validation. */
export function buildCaps(request: PlannerRequest): PlannerCapInput[] {
  const plan = buildHealthTripPlan({
    destination: request.destination,
    days: request.days,
    condition: request.condition,
    medication: request.medication,
    hasSunLifeTravelCoverage: false,
  });
  return plan.itinerary.map((day) => ({
    day: day.day,
    stepCap: day.stepCap,
    walkingCapKm: day.walkingCapKm,
    checkpoint: day.healthCheckpoint,
  }));
}
