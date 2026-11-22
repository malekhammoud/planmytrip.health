/**
 * Seed the trip cache from a captured swarm row or a saved plan JSON file.
 *
 * Usage:
 *   tsx scripts/seed-cache.ts --run-id <trip_captures.run_id>
 *   tsx scripts/seed-cache.ts --plan-file /path/to/plan.json
 *
 * Inputs: DATABASE_URL for the capture row and the optional plan file.
 * Outputs: one plan cache row and/or one swarm cache row.
 * Invariants: only typed findings are stored; a malformed summary is skipped; no
 * install id, run id, or Clerk identity enters the cache key or payload.
 */

import { readFile } from "node:fs/promises";
import { closeDatabase, ensureSchema, getPool } from "@/lib/db/postgres";
import { writeCachedPlan, type PlanCacheWrite } from "@/lib/cache/planCache";
import {
  writeCachedSwarm,
  type SwarmCacheWriteWorker,
} from "@/lib/cache/swarmCache";
import { isCondition } from "@/lib/types";
import { WORKER_IDS, isWorkerId, type SwarmFindings, type WorkerId } from "@/lib/swarmTypes";
import { normalizeWorkerResult } from "@/lib/swarmGoals";
import type { PlannerRequest } from "@/lib/agent/agentTypes";

function argument(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSummary(value: string): SwarmFindings | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? (parsed as unknown as SwarmFindings) : null;
  } catch {
    return null;
  }
}

async function seedSwarm(runId: string): Promise<number> {
  await ensureSchema();
  const result = await getPool().query(
    "SELECT request_json, swarm_json FROM trip_captures WHERE run_id = $1",
    [runId],
  );
  const row = result.rows[0];
  if (!isRecord(row)) throw new Error("That capture was not found.");
  const request = row.request_json;
  if (
    !isRecord(request) ||
    typeof request.destination !== "string" ||
    !isCondition(request.condition) ||
    typeof request.medication !== "string"
  ) {
    throw new Error("That capture has no usable request.");
  }
  const entries: unknown = row.swarm_json;
  if (!Array.isArray(entries)) throw new Error("That capture has no swarm findings.");
  const values: Partial<Record<WorkerId, SwarmCacheWriteWorker>> = {};
  for (const entry of entries) {
    if (!isRecord(entry) || !isWorkerId(entry.worker)) continue;
    if (typeof entry.summary !== "string") continue;
    const findings = parseSummary(entry.summary);
    if (findings === null) continue;
    const sourceUrl =
      typeof entry.sourceUrl === "string" ? entry.sourceUrl : "";
    const normalized = normalizeWorkerResult(entry.worker, findings, sourceUrl);
    values[entry.worker] = {
      findings: normalized.findings,
      sourceUrl: normalized.sourceUrl,
      retrievedAt:
        typeof entry.retrievedAt === "string"
          ? entry.retrievedAt
          : new Date().toISOString(),
      sources: [],
      purposes: [],
    };
  }
  const present = WORKER_IDS.filter((worker) => values[worker] !== undefined);
  if (present.length !== WORKER_IDS.length) {
    throw new Error(`Only ${present.length} of 3 workers were usable.`);
  }
  await writeCachedSwarm(
    {
      destination: request.destination,
      condition: request.condition,
      medication: request.medication,
    },
    WORKER_IDS,
    values,
  );
  return present.length;
}

async function seedPlan(file: string): Promise<number> {
  const raw: unknown = JSON.parse(await readFile(file, "utf8"));
  if (!isRecord(raw) || !isRecord(raw.request) || !isRecord(raw.plan)) {
    throw new Error("The plan file must contain request, plan, research, completed, failed.");
  }
  const request = raw.request as unknown as PlannerRequest;
  if (
    typeof request.destination !== "string" ||
    typeof request.days !== "number" ||
    !isCondition(request.condition)
  ) {
    throw new Error("The plan file request is not valid.");
  }
  const research = Array.isArray(raw.research)
    ? raw.research.flatMap((entry) => {
        if (!isRecord(entry)) return [];
        if (typeof entry.agentId !== "string" || typeof entry.summary !== "string") {
          return [];
        }
        return [{ agentId: entry.agentId, ok: entry.ok === true, summary: entry.summary }];
      })
    : [];
  const completed = Array.isArray(raw.completed) ? raw.completed : [];
  const failed = Array.isArray(raw.failed) ? raw.failed : [];
  const write: PlanCacheWrite = {
    plan: raw.plan as unknown as PlanCacheWrite["plan"],
    research,
    completed: completed as PlanCacheWrite["completed"],
    failed: failed as PlanCacheWrite["failed"],
  };
  await writeCachedPlan(request, write);
  return 1;
}

async function main(): Promise<void> {
  try {
    const runId = argument("--run-id");
    const planFile = argument("--plan-file");
    if (runId === null && planFile === null) {
      throw new Error("Pass --run-id <capture> or --plan-file <json>.");
    }
    if (planFile !== null) {
      const count = await seedPlan(planFile);
      console.log(`Seeded ${count} planner cache row.`);
    }
    if (runId !== null) {
      const count = await seedSwarm(runId);
      console.log(`Seeded a verification cache row with ${count} workers.`);
    }
  } finally {
    await closeDatabase();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Cache seeding failed.");
  process.exitCode = 1;
});
