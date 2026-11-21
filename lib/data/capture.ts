/**
 * Server-side capture orchestration.
 *
 * Inputs: a validated planner request and finished plan, or a swarm request and bounded
 * findings. Outputs: one dossier or swarm update in SQLite.
 * Invariants: capture requires explicit consent plus both opaque ids; a mock plan is
 * skipped unless PLANMYTRIP_CAPTURE_MOCK=1; capture failures never reach the SSE stream.
 */

import type { AgentTripPlan, PlannerRequest } from "../agent/agentTypes";
import type { SwarmRequestBody } from "../swarmTypes";
import { buildHealthTripPlan } from "../healthTripEngine";
import { saveDossier, saveSwarmFindings } from "../db/trips";
import { buildTripDossier } from "./tripDossier";
import type { AgentResultSummary, WorkerFindingSummary } from "./types";

/** The planner half of a capture. */
export interface PlannerCaptureInput {
  request: PlannerRequest;
  plan: AgentTripPlan;
  research: readonly AgentResultSummary[];
  now: string;
}

/**
 * Builds and saves the dossier after plan_ready. The engine plan is rebuilt server-side,
 * so the stored caps and score never depend on a client-supplied copy.
 */
export function capturePlannerRun(input: PlannerCaptureInput): void {
  const { request } = input;
  if (request.captureConsent !== true) return;
  const runId = request.runId;
  const installId = request.installId;
  if (runId === undefined || installId === undefined) return;
  if (input.plan.mock === true && process.env.PLANMYTRIP_CAPTURE_MOCK !== "1") {
    return;
  }
  const enginePlan = buildHealthTripPlan({
    destination: request.destination,
    days: request.days,
    condition: request.condition,
    medication: request.medication,
    hasSunLifeTravelCoverage: request.hasSunLifeTravelCoverage === true,
  });
  const dossier = buildTripDossier({
    runId,
    installId,
    createdAt: input.now,
    request: {
      destination: request.destination,
      days: request.days,
      condition: request.condition,
      medication: request.medication,
      interests: request.interests,
      budget: request.budget,
      hasSunLifeTravelCoverage: request.hasSunLifeTravelCoverage === true,
    },
    enginePlan,
    agentPlan: input.plan,
    research: input.research,
    swarm: [],
  });
  saveDossier(dossier);
}

/** The swarm half of a capture; a stub row is created when the swarm finishes first. */
export interface SwarmCaptureInput {
  request: SwarmRequestBody;
  findings: readonly WorkerFindingSummary[];
  now: string;
}

/** Saves or updates verification findings for the same run id. */
export function captureSwarmFindings(input: SwarmCaptureInput): void {
  if (input.request.captureConsent !== true) return;
  const runId = input.request.runId;
  const installId = input.request.installId;
  if (runId === undefined || installId === undefined) return;
  saveSwarmFindings(runId, installId, input.findings, input.now);
}
