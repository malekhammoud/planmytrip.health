/**
 * Temporary OpenCode workspace and specialist agent configuration.
 *
 * Inputs: environment model settings and a live OpenCode client.
 * Outputs: a workspace directory, a generated `.opencode/opencode.json`, and a check
 * that every planner agent is discoverable.
 * Invariants: the workspace lives outside the app repository; agents may search and
 * fetch the web but may not use the shell, write files, or spawn subagents; no secret
 * is written to the config.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { OpenCodeClient } from "@opencode/client";
import type { PlannerErrorCode } from "./agentTypes";
import { PLANNER_AGENTS } from "./agentTypes";
import { AGENT_SYSTEM_PROMPTS } from "./agentProfiles";

const workspaceUser =
  typeof process.getuid === "function" ? String(process.getuid()) : "app";
const WORKSPACE = path.join(
  tmpdir(),
  `planmytrip-health-agent-workspace-${workspaceUser}`,
);

/** Runtime failure that maps to a stable planner error code. */
export class AgentRuntimeError extends Error {
  constructor(
    readonly code: PlannerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AgentRuntimeError";
  }
}

export interface AgentModelConfig {
  providerID: string;
  model: string;
  variant?: string;
}

/**
 * Reads OPENCODE_MODEL in provider/model form. The session API expects the same
 * provider and id, so the runner passes this explicitly instead of relying on a
 * possibly stale config reload.
 */
export function plannerModelConfig(): AgentModelConfig | null {
  const raw = process.env.OPENCODE_MODEL?.trim() ?? "";
  const slash = raw.indexOf("/");
  if (slash <= 0 || slash === raw.length - 1) return null;
  const providerID = raw.slice(0, slash);
  const model = raw.slice(slash + 1);
  const variant = process.env.OPENCODE_MODEL_VARIANT?.trim();
  return {
    providerID,
    model,
    ...(variant ? { variant } : {}),
  };
}

function agentConfig(): Record<string, unknown> {
  const model = plannerModelConfig();
  const agents: Record<string, unknown> = {};
  for (const meta of PLANNER_AGENTS) {
    agents[meta.id] = {
      description: `${meta.role}. ${meta.checks}`,
      mode: "primary",
      system: AGENT_SYSTEM_PROMPTS[meta.id],
      steps: meta.id === "concierge" ? 12 : 20,
      permissions: [
        { action: "*", resource: "*", effect: "deny" },
        { action: "websearch", resource: "*", effect: "allow" },
        { action: "webfetch", resource: "*", effect: "allow" },
      ],
      ...(model === null ? {} : { model }),
    };
  }
  return {
    $schema: "https://opencode.ai/config.json",
    share: "disabled",
    agents,
  };
}

/**
 * Writes the agent config into a temporary workspace and returns its directory.
 * The file is rewritten only when its content changes.
 */
export async function ensureAgentWorkspace(): Promise<string> {
  const configDir = path.join(WORKSPACE, ".opencode");
  await mkdir(configDir, { recursive: true });
  const file = path.join(configDir, "opencode.json");
  const content = `${JSON.stringify(agentConfig(), null, 2)}\n`;
  const existing = await readFile(file, "utf8").catch(() => null);
  if (existing !== content) await writeFile(file, content, "utf8");
  return WORKSPACE;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Polls the OpenCode agent registry until all seven planner agents are visible.
 * Configuration reload is asynchronous, so a short bounded poll is expected.
 */
export async function waitForPlannerAgents(
  client: OpenCodeClient,
  directory: string,
): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await client.agent.list({ location: { directory } });
    const ids = new Set(response.data.map((agent) => agent.id));
    if (PLANNER_AGENTS.every((agent) => ids.has(agent.id))) return;
    await sleep(250);
  }
  throw new AgentRuntimeError(
    "agent_unavailable",
    "The specialist agents are not available yet. Try again in a moment.",
  );
}
