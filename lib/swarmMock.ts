/**
 * Development-only mock worker events for SWARM_MOCK=1.
 *
 * Inputs: one worker id, the validated goal input, and an emit callback.
 * Outputs: plausible typed findings plus status, streaming URL, progress, and
 * completion events.
 * Invariants: every payload carries `mock: true`; the preview URL never loads a real
 * site; mock results pass the same normalising validators as live results.
 */

import {
  WORKER_SOURCES,
  normalizeWorkerResult,
  type SwarmGoalInput,
} from "@/lib/swarmGoals";
import type { SwarmEvent, SwarmFindings, WorkerId, WorkerOutcome } from "@/lib/swarmTypes";

const MOCK_PURPOSE: Record<WorkerId, string> = {
  advisory: "Reading the Government of Canada travel advisory page",
  pharmacy: "Checking international drug names and customs rules",
  coverage: "Reading the Sun Life emergency travel medical page",
};

function nowIso(): string {
  return new Date().toISOString();
}

function mockResult(worker: WorkerId, input: SwarmGoalInput): SwarmFindings {
  const destination = input.destination;
  switch (worker) {
    case "advisory":
      return {
        destinationRiskLevel: "Exercise a high degree of caution",
        riskSummary: `Mock advisory summary for ${destination}.`,
        healthNotices: [`Mock health notice for ${destination}.`],
        environmentalHazards: [`Mock environmental hazard for ${input.condition}.`],
      };
    case "pharmacy":
      return {
        genericName: input.medication || "Mock generic name",
        localBrandNames: [`Mock local brand in ${destination}`],
        customsRules: `Mock customs note for entering ${destination}.`,
        carryRules: `Mock carry note for ${input.medication || "the medication"}.`,
      };
    case "coverage":
      return {
        emergencyMedicalLimit: "Mock limit: CAD 5,000,000 per insured person.",
        preAuthorizationRules: "Mock rule: call Allianz Global Assistance before emergency care.",
        checklist: [
          { item: "Confirm emergency contact numbers before departure.", source: "page" },
          {
            item: `Carry a medication summary for ${input.medication || "each medication"}.`,
            source: "inferred",
          },
        ],
      };
  }
}

/** Emits the mock lifecycle for one worker without touching the network. */
export async function runMockWorker(
  worker: WorkerId,
  input: SwarmGoalInput,
  emit: (event: SwarmEvent) => void,
): Promise<WorkerOutcome> {
  const normalized = normalizeWorkerResult(
    worker,
    mockResult(worker, input),
    WORKER_SOURCES[worker],
  );
  const base = { worker, mock: true as const };
  emit({ event: "worker_status", data: { ...base, ts: nowIso(), status: "running" } });
  emit({
    event: "streaming_url",
    data: { ...base, ts: nowIso(), streamingUrl: `https://mock.invalid/stream/${worker}` },
  });
  emit({
    event: "worker_progress",
    data: { ...base, ts: nowIso(), purpose: MOCK_PURPOSE[worker] },
  });
  emit({
    event: "worker_complete",
    data: {
      ...base,
      ts: nowIso(),
      findings: normalized.findings,
      sourceUrl: normalized.sourceUrl,
      retrievedAt: nowIso(),
    },
  });
  return { worker, ok: true };
}
