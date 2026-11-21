import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOpenCodeClient: vi.fn<() => Promise<{ kind: string }>>(),
  ensureAgentWorkspace: vi.fn<() => Promise<string>>(),
  waitForPlannerAgents: vi.fn<(client: unknown, directory: string) => Promise<void>>(),
}));

vi.mock("./agentClient", () => ({ getOpenCodeClient: mocks.getOpenCodeClient }));
vi.mock("./agentConfig", () => ({
  ensureAgentWorkspace: mocks.ensureAgentWorkspace,
  waitForPlannerAgents: mocks.waitForPlannerAgents,
}));

const runtimeClient = { kind: "client" };
const runtime = { client: runtimeClient, directory: "/tmp/planner-workspace" };

async function loadWarmup(): Promise<typeof import("./agentWarmup")> {
  vi.resetModules();
  return import("./agentWarmup");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AGENT_MOCK", "0");
  mocks.getOpenCodeClient.mockResolvedValue(runtimeClient);
  mocks.ensureAgentWorkspace.mockResolvedValue(runtime.directory);
  mocks.waitForPlannerAgents.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("agentWarmup", () => {
  it("shares one warmup across callers", async () => {
    const { warmPlannerRuntime } = await loadWarmup();
    const first = warmPlannerRuntime();

    expect(warmPlannerRuntime()).toBe(first);
    await expect(first).resolves.toEqual(runtime);
    expect(mocks.getOpenCodeClient).toHaveBeenCalledTimes(1);
    expect(mocks.ensureAgentWorkspace).toHaveBeenCalledTimes(1);
    expect(mocks.waitForPlannerAgents).toHaveBeenCalledTimes(1);
    expect(mocks.waitForPlannerAgents).toHaveBeenCalledWith(
      runtimeClient,
      runtime.directory,
    );
  });

  it("does not cache a failed warmup", async () => {
    mocks.waitForPlannerAgents.mockRejectedValueOnce(
      new Error("The agents are not ready."),
    );
    const { warmPlannerRuntime } = await loadWarmup();

    await expect(warmPlannerRuntime()).rejects.toThrow(
      "The agents are not ready.",
    );
    await expect(warmPlannerRuntime()).resolves.toEqual(runtime);
    expect(mocks.waitForPlannerAgents).toHaveBeenCalledTimes(2);
  });

  it("swallows a startup failure and leaves no rejected promise", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.getOpenCodeClient.mockRejectedValueOnce(new Error("No local service."));
    const { startPlannerWarmup } = await loadWarmup();

    expect(() => startPlannerWarmup()).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.getOpenCodeClient).toHaveBeenCalledTimes(1);
    expect(mocks.ensureAgentWorkspace).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("[planner] runtime warmup failed (Error)");
    warn.mockRestore();
  });

  it("skips the startup warmup in the development mock mode", async () => {
    vi.stubEnv("AGENT_MOCK", "1");
    vi.stubEnv("NODE_ENV", "development");
    const { startPlannerWarmup } = await loadWarmup();

    startPlannerWarmup();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mocks.getOpenCodeClient).not.toHaveBeenCalled();
  });
});
