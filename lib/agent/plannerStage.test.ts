import { describe, expect, it } from "vitest";
import {
  createPlannerState,
  plannerReducer,
  type PlannerState,
} from "@/lib/agent/plannerReducer";
import {
  STAGE_META,
  STAGE_RAIL,
  missionStage,
  newestAgent,
  phaseCount,
  railPosition,
  railState,
  stagePosition,
  surfaceMode,
} from "@/lib/agent/plannerStage";
import type { AgentTripPlan } from "@/lib/agent/agentTypes";

const PLAN = { summary: "A paced trip." } as AgentTripPlan;

function started(): PlannerState {
  return plannerReducer(createPlannerState(1), { type: "run_started", runToken: 1 });
}

describe("plannerStage", () => {
  it("labels every stage without the queued token", () => {
    for (const meta of Object.values(STAGE_META)) {
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.label).not.toBe("Queued");
    }
    expect(STAGE_RAIL).toHaveLength(4);
  });

  it("starts at the first rail step while idle and queued", () => {
    expect(missionStage(createPlannerState())).toBe("starting");
    const state = started();
    expect(missionStage(state)).toBe("starting");
    expect(railPosition(state)).toBe(0);
    expect(surfaceMode(missionStage(state))).toBe("forming");
    expect(stagePosition(missionStage(state))).toBe(0);
  });

  it("moves to researching when a specialist session opens", () => {
    const state = plannerReducer(started(), {
      type: "agent_started",
      agentId: "stay",
      sessionId: "s1",
    });
    expect(missionStage(state)).toBe("researching");
    expect(railPosition(state)).toBe(1);
    expect(surfaceMode("researching")).toBe("researching");
    expect(stagePosition("researching")).toBe(1);
  });

  it("moves to composing when the concierge opens or an agent writes", () => {
    const writing = plannerReducer(started(), {
      type: "agent_status",
      agentId: "table",
      status: "writing",
    });
    expect(missionStage(writing)).toBe("composing");
    const concierge = plannerReducer(started(), {
      type: "agent_started",
      agentId: "concierge",
      sessionId: "s7",
    });
    expect(missionStage(concierge)).toBe("composing");
    expect(railPosition(concierge)).toBe(2);
    expect(surfaceMode("composing")).toBe("composing");
  });

  it("reaches ready only with a plan and keeps the rail there", () => {
    const ready = plannerReducer(started(), {
      type: "plan_ready",
      plan: PLAN,
      completed: ["stay"],
      failed: [],
    });
    expect(missionStage(ready)).toBe("ready");
    expect(railPosition(ready)).toBe(3);
    expect(surfaceMode("ready")).toBe("ready");
    expect(stagePosition("ready")).toBe(3);
  });

  it("reports error without moving the rail backward", () => {
    const researching = plannerReducer(started(), {
      type: "agent_started",
      agentId: "stay",
      sessionId: "s1",
    });
    const failed = plannerReducer(researching, {
      type: "planner_error",
      code: "timeout",
      message: "The concierge timed out.",
    });
    expect(missionStage(failed)).toBe("error");
    expect(railPosition(failed)).toBe(1);
    expect(surfaceMode(missionStage(failed))).toBe("forming");
  });

  it("counts phases and rail states deterministically", () => {
    const state = plannerReducer(started(), {
      type: "agent_result",
      agentId: "stay",
      ok: true,
      summary: "Three stays verified.",
    });
    expect(phaseCount(state.agents, "complete")).toBe(1);
    expect(phaseCount(state.agents, "queued")).toBe(6);
    expect(railState(0, 1, false)).toBe("done");
    expect(railState(1, 1, false)).toBe("active");
    expect(railState(1, 1, true)).toBe("failed");
    expect(railState(2, 1, false)).toBe("pending");
  });

  it("follows the agent with the newest activity line", () => {
    expect(newestAgent(createPlannerState())).toBeNull();
    const first = plannerReducer(started(), {
      type: "agent_activity",
      agentId: "stay",
      kind: "search",
      text: "Checked hotel pages.",
      ts: "2026-11-21T10:00:00.000Z",
    });
    expect(newestAgent(first)).toBe("stay");
    const second = plannerReducer(first, {
      type: "agent_activity",
      agentId: "trail",
      kind: "search",
      text: "Checked trail pages.",
      ts: "2026-11-21T10:00:01.000Z",
    });
    expect(newestAgent(second)).toBe("trail");
  });
});
