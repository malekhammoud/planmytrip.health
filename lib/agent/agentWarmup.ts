/**
 * OpenCode runtime warmup for server startup and the first live plan.
 *
 * Inputs: the memoised OpenCode client and the generated agent workspace.
 * Outputs: one shared promise that resolves with the ready client and workspace once
 * all seven planner agents are registered.
 * Invariants: startup never waits for this promise; a failed attempt is not cached, so
 * the next request can retry; no secret is logged; the warmup holds no request state.
 */

import type { OpenCodeClient } from "@opencode/client";
import { getOpenCodeClient } from "./agentClient";
import { ensureAgentWorkspace, waitForPlannerAgents } from "./agentConfig";

/** The client and workspace directory shared by every live planner run. */
export interface PlannerRuntime {
  client: OpenCodeClient;
  directory: string;
}

let warmup: Promise<PlannerRuntime> | null = null;

async function warmOnce(): Promise<PlannerRuntime> {
  const client = await getOpenCodeClient();
  const directory = await ensureAgentWorkspace();
  await waitForPlannerAgents(client, directory);
  return { client, directory };
}

/**
 * Returns the process-wide warmup promise, starting it on first use. A rejection
 * clears the memo so a transient OpenCode startup failure can be retried.
 */
export function warmPlannerRuntime(): Promise<PlannerRuntime> {
  if (warmup === null) {
    warmup = warmOnce().catch((error: unknown) => {
      warmup = null;
      throw error;
    });
  }
  return warmup;
}

/**
 * Starts the warmup without returning its promise. Used by instrumentation so a slow
 * or unavailable OpenCode service can never delay or crash server readiness. The
 * development mock mode never touches the OpenCode service.
 */
export function startPlannerWarmup(): void {
  if (process.env.AGENT_MOCK === "1" && process.env.NODE_ENV !== "production") {
    return;
  }
  void warmPlannerRuntime()
    .then((runtime) => {
      console.info(`[planner] runtime ready at ${runtime.directory}`);
    })
    .catch((error: unknown) => {
      const name =
        error instanceof Error && error.name.length > 0 ? error.name : "unknown";
      console.warn(`[planner] runtime warmup failed (${name})`);
    });
}
