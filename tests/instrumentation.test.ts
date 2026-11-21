import { afterEach, describe, expect, it, vi } from "vitest";

const startPlannerWarmup = vi.hoisted(() => vi.fn());

vi.mock("../lib/agent/agentWarmup", () => ({ startPlannerWarmup }));

import { register } from "../instrumentation";

afterEach(() => {
  vi.unstubAllEnvs();
  startPlannerWarmup.mockClear();
});

describe("instrumentation register", () => {
  it("starts the planner warmup on the Node runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NEXT_PHASE", "phase-production-server");

    await register();

    expect(startPlannerWarmup).toHaveBeenCalledTimes(1);
  });

  it("does nothing on the edge runtime or during the build", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    vi.stubEnv("NEXT_PHASE", "phase-production-server");
    await register();
    expect(startPlannerWarmup).not.toHaveBeenCalled();

    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    await register();
    expect(startPlannerWarmup).not.toHaveBeenCalled();
  });
});
