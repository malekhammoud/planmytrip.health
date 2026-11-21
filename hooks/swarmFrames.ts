/**
 * Pure SSE frame validation for the Step 6 swarm transport.
 *
 * Inputs: one parsed SseMessage, the reducer dispatch, the request id, and the latest
 * request id per worker. Outputs: typed reducer actions, plus true when swarm_done was
 * applied.
 * Invariants: unknown events, broken JSON, wrong field types, unsafe or non-allowlisted
 * preview URLs, and frames from a superseded request are dropped; findings are rebuilt
 * into the declared shapes so a malformed payload renders Not found instead of crashing.
 */

import type { Dispatch } from "react";
import type { SwarmAction } from "@/lib/swarmReducer";
import type { SseMessage } from "@/lib/sse";
import { isAllowedPreviewUrl } from "@/lib/swarmState";
import {
  WORKER_IDS,
  isWorkerId,
  type CoverageSource,
  type SwarmErrorCode,
  type SwarmFindings,
  type WorkerId,
} from "@/lib/swarmTypes";

/** Narrows an untrusted value to a plain object. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Returns a non-empty string, or null for any other value. */
export function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asWorker(value: unknown): WorkerId | null {
  return isWorkerId(value) ? value : null;
}

function asErrorCode(value: unknown): SwarmErrorCode | null {
  return value === "missing_api_key" || value === "timeout" || value === "upstream_error"
    ? value
    : null;
}

function asHttpUrl(value: unknown): string | null {
  const text = asText(value);
  if (text === null) return null;
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? text : null;
  } catch {
    return null;
  }
}

function asWorkerList(value: unknown): WorkerId[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter(isWorkerId);
}

function asTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const texts = value.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
  );
  return [...new Set(texts)];
}

/**
 * Rebuilds findings to the declared wire shape. The route normalises the values; this
 * guard makes a malformed payload render Not found rather than crash the monitor.
 */
function asFindings(worker: WorkerId, value: unknown): SwarmFindings {
  const data = isRecord(value) ? value : {};
  switch (worker) {
    case "advisory":
      return {
        destinationRiskLevel: asText(data.destinationRiskLevel),
        riskSummary: asText(data.riskSummary),
        healthNotices: asTextList(data.healthNotices),
        environmentalHazards: asTextList(data.environmentalHazards),
      };
    case "pharmacy":
      return {
        genericName: asText(data.genericName),
        localBrandNames: asTextList(data.localBrandNames),
        customsRules: asText(data.customsRules),
        carryRules: asText(data.carryRules),
      };
    case "coverage": {
      const checklist = Array.isArray(data.checklist)
        ? data.checklist.flatMap((entry) => {
            if (!isRecord(entry)) return [];
            const item = asText(entry.item);
            if (item === null) return [];
            const source: CoverageSource = entry.source === "page" ? "page" : "inferred";
            return [{ item, source }];
          })
        : [];
      return {
        emergencyMedicalLimit: asText(data.emergencyMedicalLimit),
        preAuthorizationRules: asText(data.preAuthorizationRules),
        checklist,
      };
    }
  }
}

/**
 * Validates and applies one frame. Returns true only for swarm_done, so the caller can
 * tell a complete stream from one that closed early.
 */
export function applyFrame(
  message: SseMessage,
  dispatch: Dispatch<SwarmAction>,
  requestId: number,
  latestRequest: Record<WorkerId, number>,
): boolean {
  const eventName = message.event;
  if (eventName === undefined) return false;
  let raw: unknown;
  try {
    raw = JSON.parse(message.data);
  } catch {
    return false;
  }
  if (!isRecord(raw)) return false;
  const mock = raw.mock === true ? true : undefined;

  if (eventName === "swarm_done") {
    const completed = asWorkerList(raw.completed);
    const failed = asWorkerList(raw.failed);
    if (completed === null || failed === null) return false;
    if (!WORKER_IDS.some((worker) => latestRequest[worker] === requestId)) return false;
    dispatch({ type: "swarm_done", completed, failed, mock });
    return true;
  }

  const worker = asWorker(raw.worker);
  if (worker === null || latestRequest[worker] !== requestId) return false;

  switch (eventName) {
    case "worker_status": {
      if (raw.status !== "queued" && raw.status !== "running") return false;
      dispatch({ type: "worker_status", worker, status: raw.status, mock });
      return false;
    }
    case "streaming_url": {
      if (typeof raw.streamingUrl !== "string") return false;
      if (!isAllowedPreviewUrl(raw.streamingUrl)) return false;
      dispatch({ type: "streaming_url", worker, streamingUrl: raw.streamingUrl, mock });
      return false;
    }
    case "worker_progress": {
      if (typeof raw.purpose !== "string") return false;
      dispatch({ type: "worker_progress", worker, purpose: raw.purpose, mock });
      return false;
    }
    case "worker_complete": {
      dispatch({
        type: "worker_complete",
        worker,
        findings: asFindings(worker, raw.findings),
        sourceUrl: asHttpUrl(raw.sourceUrl) ?? "",
        retrievedAt: typeof raw.retrievedAt === "string" ? raw.retrievedAt : "",
        ...(typeof raw.rawResult === "string" ? { rawResult: raw.rawResult } : {}),
        ...(typeof raw.parseError === "string" ? { parseError: raw.parseError } : {}),
        mock,
      });
      return false;
    }
    case "worker_error": {
      const cause = asText(raw.message);
      if (cause === null) return false;
      dispatch({
        type: "worker_error",
        worker,
        code: asErrorCode(raw.code) ?? "upstream_error",
        message: cause,
        mock,
      });
      return false;
    }
    default:
      return false;
  }
}
