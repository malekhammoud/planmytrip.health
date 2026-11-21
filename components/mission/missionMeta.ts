/**
 * Static labels and formatting helpers for the mission control.
 *
 * Inputs: worker ids, phases, timestamps, and URLs.
 * Outputs: display names, hosts, phase labels, clocks, and durations.
 * Invariants: no worker is hidden and no missing value is invented; hosts come from a
 * parsed URL or fall back to the configured source host.
 */

import type { StatusGlyphState } from "@/components/ui";
import type { WorkerPhase } from "@/lib/swarmReducer";
import { WORKER_IDS, type WorkerId } from "@/lib/swarmTypes";

/** Display metadata for one worker. */
export interface MissionWorkerMeta {
  name: string;
  host: string;
  checks: string;
}

/** Worker order and copy used by the status bar, tiles, and pre-run rows. */
export const MISSION_WORKERS: Record<WorkerId, MissionWorkerMeta> = {
  advisory: {
    name: "Travel advisory",
    host: "travel.gc.ca",
    checks: "Destination risk level, health notices, and environmental hazards.",
  },
  pharmacy: {
    name: "Medication and customs",
    host: "drugs.com",
    checks: "Generic name, local brands, customs rules, and carry rules.",
  },
  coverage: {
    name: "Emergency medical coverage",
    host: "sunlife.ca",
    checks: "Emergency medical limit and pre-authorization rules.",
  },
};

/** Short worker tag used in the feed and source rows. */
export const WORKER_TAG: Record<WorkerId, string> = {
  advisory: "Advisory",
  pharmacy: "Pharmacy",
  coverage: "Coverage",
};

/** Phase copy. The internal queued token never renders as Queued. */
export const PHASE_LABEL: Record<WorkerPhase, string> = {
  idle: "Ready",
  queued: "Preparing",
  running: "Running",
  complete: "Complete",
  error: "Needs retry",
};

/** Status glyph shape for each phase. */
export const PHASE_GLYPH: Record<WorkerPhase, StatusGlyphState> = {
  idle: "queued",
  queued: "queued",
  running: "running",
  complete: "done",
  error: "error",
};

/** The line shown when a worker has no current purpose yet. */
export const PHASE_ACTIVITY: Record<WorkerPhase, string> = {
  idle: "Ready when the next verification runs.",
  queued: "Preparing the browser.",
  running: "Opening the page.",
  complete: "Stream ended.",
  error: "This check needs a retry.",
};

/** Returns the worker list in canonical order. */
export function missionWorkers(): readonly WorkerId[] {
  return WORKER_IDS;
}

/** Formats an elapsed duration as MM:SS, or H:MM:SS past one hour. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const body = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${body}` : body;
}

/** Formats a relative offset from the first step as +MM:SS. */
export function formatOffset(at: number, origin: number): string {
  return `+${formatDuration(at - origin)}`;
}

/** Extracts a display host from an absolute URL, or returns the fallback. */
export function hostOf(url: string | null | undefined, fallback = "No URL"): string {
  if (url === undefined || url === null || url.trim() === "") return fallback;
  try {
    return new URL(url).host;
  } catch {
    return fallback;
  }
}

/** Formats a retrieved ISO timestamp in UTC without locale-dependent output. */
export function formatRetrievedAt(value: string | null): string {
  if (value === null || value === "") return "Not found";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not found";
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
