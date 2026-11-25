import { describe, expect, it } from "vitest";
import { applyPlannerFrame } from "./plannerFrames";
import { buildMockPlan } from "@/lib/agent/agentMock";
import {
  createPlannerState,
  plannerReducer,
  type PlannerAction,
  type PlannerState,
} from "@/lib/agent/plannerReducer";
import type { PlannerRequest } from "@/lib/agent/agentTypes";

const request: PlannerRequest = {
  destination: "Tokyo, Japan",
  origin: "",
  transport: "mixed",
  checkIn: "",
  travelers: 1,
  days: 4,
  condition: "asthma_respiratory",
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

function apply(
  state: PlannerState,
  event: string | undefined,
  data: unknown,
): PlannerState {
  let next = state;
  const dispatch = (action: PlannerAction): void => {
    next = plannerReducer(next, action);
  };
  applyPlannerFrame(
    { event, data: typeof data === "string" ? data : JSON.stringify(data) },
    dispatch,
  );
  return next;
}

describe("applyPlannerFrame", () => {
  it("applies the roster, activity, and plan frames", () => {
    let state = createPlannerState(1);
    state = apply(state, "planner_started", { ts: "2026-11-21T10:00:00.000Z" });
    expect(state.status).toBe("running");

    state = apply(state, "agent_started", {
      agentId: "stay",
      sessionId: "ses_1",
      ts: "2026-11-21T10:00:00.000Z",
    });
    state = apply(state, "agent_status", {
      agentId: "concierge",
      status: "queued",
      message: "Waiting for specialist research",
      ts: "2026-11-21T10:00:00.000Z",
    });
    expect(state.agents.concierge.message).toBe("Waiting for specialist research");
    state = apply(state, "agent_activity", {
      agentId: "stay",
      kind: "search",
      text: "Searching: hotels",
      ts: "2026-11-21T10:00:01.000Z",
    });
    expect(state.agents.stay.sessionId).toBe("ses_1");
    expect(state.log[0]?.text).toBe("Searching: hotels");

    state = apply(state, "plan_ready", {
      plan,
      completed: ["stay", "concierge"],
      failed: ["trail"],
      ts: "2026-11-21T10:02:00.000Z",
    });
    expect(state.status).toBe("complete");
    expect(state.plan?.days).toHaveLength(4);
    expect(state.plan?.mock).toBe(true);
  });

  it("returns true only for planner_done", () => {
    let seenDone = false;
    const dispatch = (action: PlannerAction): void => {
      void action;
    };
    seenDone = applyPlannerFrame(
      {
        event: "planner_done",
        data: JSON.stringify({
          completed: ["stay"],
          failed: [],
          ts: "2026-11-21T10:00:00.000Z",
        }),
      },
      dispatch,
    );
    expect(seenDone).toBe(true);
    expect(
      applyPlannerFrame(
        {
          event: "agent_activity",
          data: JSON.stringify({
            agentId: "stay",
            kind: "search",
            text: "Searching",
            ts: "2026-11-21T10:00:00.000Z",
          }),
        },
        dispatch,
      ),
    ).toBe(false);
  });

  it("drops malformed, unknown, and unsafe frames", () => {
    const state = createPlannerState(1);
    const dispatch = (action: PlannerAction): void => {
      void action;
    };
    for (const message of [
      { event: "agent_activity", data: "not json" },
      { event: "agent_activity", data: JSON.stringify({ agentId: "unknown" }) },
      { event: "unknown", data: JSON.stringify({}) },
      {
        event: "plan_ready",
        data: JSON.stringify({ plan: { summary: "x", days: [] } }),
      },
      { event: undefined, data: JSON.stringify({}) },
    ]) {
      expect(applyPlannerFrame(message, dispatch)).toBe(false);
    }
    expect(state.status).toBe("idle");
  });
});
