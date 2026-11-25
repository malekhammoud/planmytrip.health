/**
 * Instant SSE frames for a cache hit.
 *
 * Inputs: a normalised cached planner or verification result and a clock.
 * Outputs: the same event contracts a live run uses, marked `cached: true`.
 * Invariants: planner_done is last; swarm_done is last; every cached frame carries real
 * recorded provenance; no progress line or finding is invented and no preview URL is
 * replayed after it expires.
 */

import type { AgentTripPlan, PlannerEvent } from "@/lib/agent/agentTypes";
import { PLANNER_AGENT_IDS, PLANNER_AGENTS } from "@/lib/agent/agentTypes";
import type { CachedPlan } from "./planCache";
import type { CachedSwarm } from "./swarmCache";
import type { SwarmEvent, SwarmSourceItem, WorkerId } from "@/lib/swarmTypes";

function fallbackSummary(agentId: (typeof PLANNER_AGENT_IDS)[number], cached: CachedPlan): string {
  if (cached.failed.includes(agentId)) {
    return agentId === "concierge"
      ? "Cached run used verified picks in a fallback route."
      : "Cached run did not finish this specialist.";
  }
  return agentId === "concierge" ? cached.plan.summary : "Cached verified research.";
}

/** Builds the complete planner replay, ending with planner_done. */
export function buildCachedPlannerEvents(
  cached: CachedPlan,
  now = new Date().toISOString(),
): PlannerEvent[] {
  const events: PlannerEvent[] = [
    {
      event: "planner_started",
      data: { agents: PLANNER_AGENTS, ts: now, cached: true },
    },
  ];
  for (const agentId of PLANNER_AGENT_IDS) {
    const result = cached.research.find((entry) => entry.agentId === agentId);
    const ok = cached.completed.includes(agentId);
    events.push({
      event: "agent_result",
      data: {
        agentId,
        ok,
        summary: result?.summary ?? fallbackSummary(agentId, cached),
        ts: now,
        cached: true,
      },
    });
  }
  const plan: AgentTripPlan = cached.plan;
  events.push({
    event: "plan_ready",
    data: {
      plan,
      completed: cached.completed,
      failed: cached.failed,
      ts: now,
      cached: true,
      cachedAt: cached.cachedAt,
      cacheMatch: cached.match,
    },
  });
  events.push({
    event: "planner_done",
    data: { completed: cached.completed, failed: cached.failed, ts: now, cached: true },
  });
  return events;
}

function countSources(workers: readonly CachedSwarm["workers"][WorkerId][]): number {
  const seen = new Set<string>();
  for (const worker of workers) {
    if (worker === undefined) continue;
    for (const item of worker.sources) {
      seen.add(item.url ?? `title:${item.title ?? ""}`);
    }
  }
  return seen.size;
}

/** Builds the complete verification replay, ending with swarm_done. */
export function buildCachedSwarmEvents(
  cached: CachedSwarm,
  workers: readonly WorkerId[],
  now = new Date().toISOString(),
): SwarmEvent[] {
  const events: SwarmEvent[] = [];
  let steps = 0;
  let findings = 0;
  const present: CachedSwarm["workers"][WorkerId][] = [];
  for (const worker of workers) {
    const value = cached.workers[worker];
    if (value === undefined) continue;
    present.push(value);
    const startedAt = value.startedAt ?? now;
    const endedAt = value.endedAt ?? now;
    let seq = 0;
    const next = (): number => {
      seq += 1;
      return seq;
    };
    events.push({
      event: "worker_status",
      data: { worker, seq: next(), ts: now, status: "running", cached: true },
    });
    events.push({
      event: "worker_started",
      data: {
        worker,
        seq: next(),
        ts: now,
        runId: null,
        startedAt,
        cached: true,
      },
    });
    if (value.sources.length > 0) {
      const items: SwarmSourceItem[] = value.sources.slice(0, 100);
      events.push({
        event: "worker_sources",
        data: { worker, seq: next(), ts: now, items, cached: true },
      });
    }
    for (const purpose of value.purposes.slice(0, 200)) {
      steps += 1;
      events.push({
        event: "worker_progress",
        data: {
          worker,
          seq: next(),
          ts: now,
          purpose: purpose.purpose,
          ...(purpose.tinyfishApi === undefined
            ? {}
            : { tinyfishApi: purpose.tinyfishApi }),
          cached: true,
        },
      });
    }
    findings += 1;
    events.push({
      event: "worker_complete",
      data: {
        worker,
        seq: next(),
        ts: endedAt,
        findings: value.findings,
        sourceUrl: value.sourceUrl,
        retrievedAt: value.retrievedAt,
        cached: true,
        cachedAt: cached.cachedAt,
        ...(value.rawResult === undefined ? {} : { rawResult: value.rawResult }),
        ...(value.parseError === undefined ? {} : { parseError: value.parseError }),
      },
    });
  }
  events.push({
    event: "swarm_done",
    data: {
      worker: "swarm",
      seq: 1,
      ts: now,
      completed: [...workers],
      failed: [],
      summary: {
        steps,
        sources: countSources(present),
        findings,
        unknownEvents: 0,
      },
      cached: true,
      cachedAt: cached.cachedAt,
    },
  });
  return events;
}
