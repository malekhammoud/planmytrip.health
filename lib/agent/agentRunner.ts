/**
 * Live OpenCode concierge orchestration.
 *
 * Inputs: a validated request, an emit callback, an abort signal, and a mock flag.
 * Outputs: the planner SSE event sequence, ending with planner_done.
 * Invariants: six research specialists run in parallel, one concierge synthesises their
 * verified output, the engine's day ceilings are attached to every day, and no stream
 * closes without planner_done. Failures stay isolated so one specialist cannot sink the
 * trip. Session mechanics live in agentSession; this module owns the team sequence.
 */

import { CONDITION_PROFILES } from "@/lib/conditionProfiles";
import { getOpenCodeClient } from "./agentClient";
import {
  AgentRuntimeError,
  ensureAgentWorkspace,
  waitForPlannerAgents,
} from "./agentConfig";
import { buildFallbackPlan } from "./agentFallback";
import { geocodePlan } from "./agentGeocode";
import { runMockPlanner } from "./agentMock";
import {
  extractJsonObject,
  normalizeSpecialistResult,
  specialistSucceeded,
  type SpecialistResult,
} from "./agentParse";
import { buildConciergePlan } from "./agentPlanParse";
import { buildConciergePrompt, buildSpecialistPrompt } from "./agentPrompts";
import {
  CONCIERGE_TIMEOUT_MS,
  SPECIALIST_TIMEOUT_MS,
  buildCaps,
  createAgent,
  emitResult,
  emitStatus,
  handleAgentEvent,
  nowIso,
  runAgent,
  type LiveAgent,
  type PlannerRunContext,
} from "./agentSession";
import {
  PLANNER_AGENTS,
  PLANNER_AGENT_IDS,
  SPECIALIST_AGENT_IDS,
  type AgentTripPlan,
  type PlannerAgentId,
  type PlannerErrorCode,
  type PlannerRequest,
  type SpecialistAgentId,
} from "./agentTypes";

interface OpenCodeEventLike {
  type: string;
  data?: unknown;
}

interface RunTracker {
  completed: PlannerAgentId[];
  failed: PlannerAgentId[];
  quota: boolean;
}

function errorMessage(code: PlannerErrorCode): string {
  switch (code) {
    case "agent_unavailable":
      return "Live planning is unavailable right now. The safety envelope below still works.";
    case "timeout":
      return "The planning team took too long. Try again with fewer days.";
    case "invalid_plan":
      return "The planning team returned an incomplete plan. Try again.";
    case "invalid_request":
      return "That trip request is incomplete. Check the destination and duration.";
    case "upstream_error":
      return "The planning team could not finish. Try again in a moment.";
  }
}

function ordered(ids: readonly PlannerAgentId[]): PlannerAgentId[] {
  return PLANNER_AGENT_IDS.filter((id) => ids.includes(id));
}

async function executeLive(
  request: PlannerRequest,
  caps: ReturnType<typeof buildCaps>,
  context: PlannerRunContext,
  tracker: RunTracker,
): Promise<void> {
  const client = await getOpenCodeClient();
  const directory = await ensureAgentWorkspace();
  await waitForPlannerAgents(client, directory);

  const byId = new Map<PlannerAgentId, LiveAgent>(
    PLANNER_AGENT_IDS.map((id) => [id, createAgent(id)]),
  );
  const bySession = new Map<string, LiveAgent>();
  const eventAbort = new AbortController();
  const onAbort = (): void => {
    eventAbort.abort();
    for (const agent of byId.values()) {
      agent.settle({ ok: false, reason: "aborted" });
    }
  };
  if (context.signal.aborted) onAbort();
  else context.signal.addEventListener("abort", onAbort, { once: true });

  const subscription = client.event.subscribe({
    signal: eventAbort.signal,
  }) as unknown as AsyncIterable<OpenCodeEventLike>;
  const pump = (async () => {
    try {
      for await (const event of subscription) {
        if (context.signal.aborted) break;
        handleAgentEvent(event, bySession, context);
      }
    } catch {
      // A closed subscription is expected on abort and after a run ends.
    }
  })();

  const research: Partial<Record<SpecialistAgentId, SpecialistResult>> = {};
  try {
    await Promise.all(
      SPECIALIST_AGENT_IDS.map(async (agentId) => {
        const prompt = buildSpecialistPrompt(agentId, request);
        const text = await runAgent(
          client,
          directory,
          agentId,
          prompt,
          SPECIALIST_TIMEOUT_MS,
          context,
          byId,
          bySession,
        );
        if (text === null) {
          if (!tracker.failed.includes(agentId)) tracker.failed.push(agentId);
          if (byId.get(agentId)?.quota === true) tracker.quota = true;
          emitResult(context, agentId, false, "No usable research returned.");
          return;
        }
        const json = extractJsonObject(text);
        if (json === null) {
          if (!tracker.failed.includes(agentId)) tracker.failed.push(agentId);
          emitStatus(context, agentId, "error", "The research format was not readable.");
          emitResult(context, agentId, false, "Unreadable research.");
          return;
        }
        const result = normalizeSpecialistResult(agentId, json);
        if (!specialistSucceeded(result)) {
          if (!tracker.failed.includes(agentId)) tracker.failed.push(agentId);
          emitStatus(context, agentId, "error", "No verified place was found.");
          emitResult(context, agentId, false, result.summary);
          return;
        }
        research[agentId] = result;
        tracker.completed.push(agentId);
        emitStatus(context, agentId, "complete");
        emitResult(context, agentId, true, result.summary);
      }),
    );

    if (Object.keys(research).length === 0) {
      throw new AgentRuntimeError(
        tracker.quota ? "agent_unavailable" : "upstream_error",
        "No specialist returned usable research.",
      );
    }

    let plan: AgentTripPlan | null = null;
    const conciergeText = await runAgent(
      client,
      directory,
      "concierge",
      buildConciergePrompt(request, research, caps),
      CONCIERGE_TIMEOUT_MS,
      context,
      byId,
      bySession,
    );
    if (conciergeText !== null) {
      const json = extractJsonObject(conciergeText);
      if (json !== null) {
        try {
          plan = buildConciergePlan(json, request, research, caps, nowIso());
        } catch {
          plan = null;
        }
      }
    }

    if (plan === null) {
      if (!tracker.failed.includes("concierge")) tracker.failed.push("concierge");
      plan = buildFallbackPlan({
        request,
        research,
        caps,
        recoveryMinutes: CONDITION_PROFILES[request.condition].recoveryMinutes,
        now: nowIso(),
      });
      emitStatus(
        context,
        "concierge",
        "error",
        "The route could not be synthesised. Using verified picks.",
      );
      emitResult(context, "concierge", false, "Verified picks used in a fallback route.");
    } else {
      tracker.completed.push("concierge");
      emitStatus(context, "concierge", "complete");
      emitResult(context, "concierge", true, "Route and rest days ready.");
    }

    plan = await geocodePlan(plan, request.destination, context.signal);

    context.emit({
      event: "plan_ready",
      data: {
        plan,
        completed: ordered(tracker.completed),
        failed: ordered(tracker.failed),
        ts: nowIso(),
      },
    });
  } finally {
    eventAbort.abort();
    context.signal.removeEventListener("abort", onAbort);
    await pump.catch(() => {});
    for (const agent of byId.values()) {
      if (agent.sessionID === null) continue;
      void client.session.interrupt({ sessionID: agent.sessionID }).catch(() => {});
      void client.session.remove({ sessionID: agent.sessionID }).catch(() => {});
    }
  }
}

/**
 * Runs the concierge either live or in mock mode and guarantees a final planner_done.
 * A runtime failure emits one safe error frame; partial research is still reported.
 */
export async function runPlanner(
  request: PlannerRequest,
  context: PlannerRunContext,
  mock: boolean,
): Promise<void> {
  const caps = buildCaps(request);
  if (mock) {
    await runMockPlanner(request, caps, context.emit, context.signal);
    return;
  }

  context.emit({
    event: "planner_started",
    data: { agents: PLANNER_AGENTS, ts: nowIso() },
  });
  const tracker: RunTracker = { completed: [], failed: [], quota: false };
  try {
    await executeLive(request, caps, context, tracker);
  } catch (error) {
    const code =
      error instanceof AgentRuntimeError ? error.code : "upstream_error";
    context.emit({
      event: "planner_error",
      data: { code, message: errorMessage(code), ts: nowIso() },
    });
    for (const id of PLANNER_AGENT_IDS) {
      if (!tracker.completed.includes(id) && !tracker.failed.includes(id)) {
        tracker.failed.push(id);
      }
    }
  } finally {
    context.emit({
      event: "planner_done",
      data: {
        completed: ordered(tracker.completed),
        failed: ordered(tracker.failed),
        ts: nowIso(),
      },
    });
  }
}
