import { describe, expect, it } from "vitest";
import { buildMockPlan } from "./agentMock";
import {
  createPlannerState,
  createQueuedPlannerState,
  plannerReducer,
} from "./plannerReducer";
import type { PlannerAction } from "./plannerReducer";
import type { PlannerRequest } from "./agentTypes";

const request: PlannerRequest = {
  destination: "Lisbon, Portugal",
  origin: "",
  transport: "mixed",
  checkIn: "",
  travelers: 1,
  days: 4,
  condition: "asthma_respiratory",
  medication: "albuterol",
  interests: "",
  budget: "balanced",
};

const caps = Array.from({ length: 4 }, (_, index) => ({
  day: index + 1,
  stepCap: 3150,
  walkingCapKm: 1.8,
  checkpoint: `Checkpoint ${index + 1}`,
}));

const plan = buildMockPlan(request, caps, "2026-11-21T10:00:00.000Z");

function apply(state: ReturnType<typeof createPlannerState>, action: PlannerAction) {
  return plannerReducer(state, action);
}

describe("plannerReducer", () => {
  it("starts idle and queues every agent on a new run token", () => {
    const idle = createPlannerState();
    expect(idle.status).toBe("idle");
    expect(idle.agents.stay.phase).toBe("idle");
    const running = apply(idle, { type: "run_started", runToken: 2 });
    expect(running.status).toBe("running");
    expect(running.runToken).toBe(2);
    expect(running.agents.concierge.phase).toBe("queued");
    expect(createQueuedPlannerState(3).status).toBe("running");
  });

  it("records lifecycle, activity, and result state", () => {
    let state = apply(createPlannerState(1), { type: "run_started", runToken: 1 });
    state = apply(state, { type: "planner_started" });
    state = apply(state, {
      type: "agent_started",
      agentId: "stay",
      sessionId: "ses_1",
    });
    state = apply(state, {
      type: "agent_status",
      agentId: "stay",
      status: "researching",
    });
    state = apply(state, {
      type: "agent_activity",
      agentId: "stay",
      kind: "search",
      text: "Searching: Lisbon hotels",
      ts: "2026-11-21T10:00:00.000Z",
    });
    expect(state.agents.stay.phase).toBe("researching");
    expect(state.agents.stay.sessionId).toBe("ses_1");
    expect(state.agents.stay.activity).toEqual(["Searching: Lisbon hotels"]);
    expect(state.log).toHaveLength(1);

    state = apply(state, {
      type: "agent_result",
      agentId: "stay",
      ok: true,
      summary: "4 verified places",
    });
    expect(state.agents.stay.phase).toBe("complete");
    expect(state.agents.stay.resultSummary).toBe("4 verified places");
  });

  it("stores phase messages and clears them as the lifecycle advances", () => {
    let state = apply(createPlannerState(1), { type: "run_started", runToken: 1 });
    state = apply(state, {
      type: "agent_status",
      agentId: "stay",
      status: "queued",
      message: "Preparing the agent runtime",
    });
    expect(state.agents.stay.message).toBe("Preparing the agent runtime");

    state = apply(state, {
      type: "agent_status",
      agentId: "stay",
      status: "researching",
    });
    expect(state.agents.stay.message).toBeNull();

    state = apply(state, {
      type: "agent_status",
      agentId: "stay",
      status: "error",
      message: "Timed out while researching.",
    });
    expect(state.agents.stay.message).toBeNull();
    expect(state.agents.stay.error).toBe("Timed out while researching.");

    state = apply(state, {
      type: "agent_status",
      agentId: "stay",
      status: "queued",
      message: "   ",
    });
    expect(state.agents.stay.message).toBeNull();

    state = apply(state, {
      type: "agent_status",
      agentId: "stay",
      status: "queued",
      message: "Opening a specialist session",
    });
    state = apply(state, {
      type: "agent_result",
      agentId: "stay",
      ok: true,
      summary: "4 verified places",
    });
    expect(state.agents.stay.message).toBeNull();
    expect(state.agents.stay.phase).toBe("complete");
  });

  it("keeps the ready plan through planner_done", () => {
    let state = apply(createPlannerState(1), { type: "run_started", runToken: 1 });
    state = apply(state, {
      type: "plan_ready",
      plan,
      completed: ["stay", "table"],
      failed: ["trail"],
      mock: true,
    });
    expect(state.status).toBe("complete");
    expect(state.mock).toBe(true);
    expect(state.plan).toBe(plan);
    state = apply(state, {
      type: "planner_done",
      completed: ["stay", "table"],
      failed: ["trail"],
    });
    expect(state.status).toBe("complete");
    expect(state.plan).toBe(plan);
  });

  it("turns a done without a plan into an error", () => {
    let state = apply(createPlannerState(1), { type: "run_started", runToken: 1 });
    state = apply(state, { type: "planner_done", completed: [], failed: ["stay"] });
    expect(state.status).toBe("error");
  });

  it("bounds the activity log and ignores empty activities", () => {
    let state = apply(createPlannerState(1), { type: "run_started", runToken: 1 });
    for (let index = 0; index < 30; index += 1) {
      state = apply(state, {
        type: "agent_activity",
        agentId: "table",
        kind: "note",
        text: `Note ${index}`,
        ts: "2026-11-21T10:00:00.000Z",
      });
    }
    expect(state.log).toHaveLength(24);
    state = apply(state, {
      type: "agent_activity",
      agentId: "table",
      kind: "note",
      text: "   ",
      ts: "2026-11-21T10:00:00.000Z",
    });
    expect(state.log).toHaveLength(24);
  });

  it("records a stream failure as a planner error", () => {
    const state = apply(createPlannerState(1), {
      type: "stream_failed",
      message: "Connection lost.",
    });
    expect(state.status).toBe("error");
    expect(state.error).toEqual({
      code: "upstream_error",
      message: "Connection lost.",
    });
  });
});
