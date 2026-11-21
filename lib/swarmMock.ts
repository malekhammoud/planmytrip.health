/**
 * Development-only mock timeline for SWARM_MOCK=1.
 *
 * Inputs: one worker id, the validated goal input, an emit callback, a sequence source,
 * and mock options (speed, failing worker).
 * Outputs: a scripted, seeded TinyFish-like timeline: start, preview URL, 12-20 progress
 * steps at irregular intervals, 2-3 source batches, heartbeats, then complete or a
 * SITE_BLOCKED failure. Every payload carries `mock: true`.
 * Invariants: the timeline is deterministic for a worker, the preview never loads a real
 * site, mock findings pass the same normalising validators as live results, and no
 * findings are emitted before COMPLETE.
 */

import {
  WORKER_SOURCES,
  normalizeWorkerResult,
  type SwarmGoalInput,
} from "@/lib/swarmGoals";
import type {
  SwarmEvent,
  SwarmFindings,
  SwarmSourceItem,
  WorkerId,
  WorkerOutcome,
} from "@/lib/swarmTypes";

/** Mock-only knobs; the route reads them from the environment. */
export interface MockRunOptions {
  /** Multiplies the scripted clock; 1 is the realistic demo speed. */
  speed: number;
  /** Worker that fails with SITE_BLOCKED instead of completing. */
  failWorker: WorkerId | null;
}

/** Total scripted duration per worker, in virtual seconds. */
const TOTAL_SECONDS: Record<WorkerId, number> = {
  advisory: 35,
  pharmacy: 48,
  coverage: 62,
};

const PURPOSES: Record<WorkerId, readonly string[]> = {
  advisory: [
    "Opening the travel advisories page",
    "Searching for the destination entry",
    "Reading the advisory summary",
    "Checking the health notices section",
    "Scanning environmental hazards",
    "Opening the regional advisory detail",
    "Searching for outbreak notices",
    "Reading the safety and security notes",
    "Checking the entry requirements section",
    "Comparing the advisory level wording",
    "Scanning recent advisory updates",
    "Searching for seasonal health risks",
    "Reading the destination risk level",
    "Checking the return-to-Canada notes",
    "Scanning the travel health page",
    "Reading the emergency contact section",
    "Searching for air quality notices",
    "Checking the heat advisory detail",
    "Reading the local health services note",
    "Opening the advisory source page",
  ],
  pharmacy: [
    "Opening the international drug names page",
    "Searching for the generic name",
    "Reading the medication entry",
    "Checking local brand names",
    "Opening the customs guidance page",
    "Searching for carry rules",
    "Reading the prescription documentation note",
    "Checking the controlled medication section",
    "Scanning the destination import rules",
    "Searching for the brand availability note",
    "Reading the pharmacy contact section",
    "Checking the traveller medication allowance",
    "Scanning the customs declaration guidance",
    "Reading the carry-on rules",
    "Searching for the local equivalent",
    "Checking the packaging requirements",
    "Reading the prescription copy guidance",
    "Opening the destination pharmacy listing",
    "Searching for the customs office note",
    "Reading the medication summary",
  ],
  coverage: [
    "Opening the emergency travel medical page",
    "Searching for the coverage limit",
    "Reading the eligibility section",
    "Checking the pre-authorization rules",
    "Opening the contact page",
    "Searching for the assistance provider",
    "Reading the claim checklist",
    "Checking the trip length cap",
    "Scanning the exclusions section",
    "Searching for the stability wording",
    "Reading the emergency contact numbers",
    "Checking the policy document note",
    "Scanning the pre-departure checklist",
    "Reading the coverage summary",
    "Searching for the plan administrator note",
    "Checking the medical questionnaire rules",
    "Reading the claim submission guidance",
    "Opening the travel insurance page",
    "Searching for the assistance hours",
    "Reading the coverage source page",
  ],
};

const SOURCE_TITLES: Record<WorkerId, readonly string[]> = {
  advisory: [
    "Travel advice and advisories",
    "Health notices",
    "Safety and security",
    "Entry requirements",
  ],
  pharmacy: [
    "International drug names",
    "Customs and border guidance",
    "Medication carry rules",
    "Local pharmacy listings",
  ],
  coverage: [
    "Emergency travel medical insurance",
    "Pre-authorization",
    "Claims checklist",
    "Contact the plan administrator",
  ],
};

function hashSeed(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Mulberry32, small and stable across runtimes for reproducible mock timelines. */
function prng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** One scripted mock step; exported so tests can assert determinism. */
export interface MockTimelineEntry {
  atMs: number;
  kind: "progress" | "sources" | "heartbeat" | "complete" | "fail";
  purpose?: string;
  api?: "search" | "fetch";
  items?: SwarmSourceItem[];
}

function buildSources(
  worker: WorkerId,
  destination: string,
  random: () => number,
  api: "search" | "fetch",
): SwarmSourceItem[] {
  const titles = SOURCE_TITLES[worker];
  const count = 1 + Math.floor(random() * 2);
  const items: SwarmSourceItem[] = [];
  for (let index = 0; index < count; index += 1) {
    const title = titles[Math.floor(random() * titles.length)] ?? titles[0];
    items.push({
      url: `${WORKER_SOURCES[worker]}#mock-${worker}-${Math.round(random() * 10_000)}`,
      title: `${title} for ${destination}`,
      api,
    });
  }
  return items;
}

/**
 * Builds the deterministic timeline for one worker. Times are virtual milliseconds;
 * the runner divides them by the speed multiplier.
 */
export function createMockTimeline(
  worker: WorkerId,
  input: SwarmGoalInput,
  options: MockRunOptions,
): MockTimelineEntry[] {
  const random = prng(hashSeed(`${worker}|${input.destination}`));
  const totalMs = (TOTAL_SECONDS[worker] * 1000) / Math.max(options.speed, 0.001);
  const steps = 12 + Math.floor(random() * 9);
  const weights = Array.from({ length: steps }, () => 0.6 + random() * 1.6);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const purposes = PURPOSES[worker];
  const sourceSteps = new Set<number>();
  const sourceCount = 2 + Math.floor(random() * 2);
  while (sourceSteps.size < sourceCount) {
    sourceSteps.add(1 + Math.floor(random() * (steps - 2)));
  }

  const entries: MockTimelineEntry[] = [];
  let elapsedWeight = 0;
  for (let index = 0; index < steps; index += 1) {
    elapsedWeight += weights[index] ?? 1;
    const atMs = Math.round((elapsedWeight / weightTotal) * totalMs);
    const purpose = purposes[index % purposes.length] ?? purposes[0] ?? "Reading the page";
    const api = random() > 0.55 ? "search" : "fetch";
    entries.push({ atMs, kind: "progress", purpose, api });
    if (sourceSteps.has(index)) {
      entries.push({
        atMs: Math.min(atMs + 120, totalMs - 1),
        kind: "sources",
        api,
        items: buildSources(worker, input.destination, random, api),
      });
    }
  }

  for (let atMs = 5_000; atMs < totalMs; atMs += 5_000) {
    entries.push({ atMs, kind: "heartbeat" });
  }

  const completion: MockTimelineEntry =
    options.failWorker === worker
      ? { atMs: totalMs * 0.42, kind: "fail" }
      : { atMs: totalMs, kind: "complete" };
  entries.sort((left, right) => left.atMs - right.atMs);
  // Rounding can push the final progress step past the scripted total; completion is
  // always the last event so no finding or failure is emitted before its step.
  return [...entries.filter((entry) => entry.atMs < completion.atMs), completion];
}

function mockResult(worker: WorkerId, input: SwarmGoalInput): SwarmFindings {
  const destination = input.destination;
  switch (worker) {
    case "advisory":
      return {
        destinationRiskLevel: "Exercise a high degree of caution",
        riskSummary: `Mock advisory summary for ${destination}.`,
        healthNotices: [`Mock measles outbreak notice for ${destination}.`],
        environmentalHazards: [
          `Mock heat and poor air quality advisory for ${input.condition}.`,
        ],
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

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function tsNow(): string {
  return new Date().toISOString();
}

/**
 * Emits the mock lifecycle for one worker without touching the network. The timeline
 * runs in real time divided by `options.speed`, so a 62-second scenario finishes in
 * about 1.2 seconds at speed 50.
 */
export async function runMockWorker(
  worker: WorkerId,
  input: SwarmGoalInput,
  emit: (event: SwarmEvent) => void,
  nextSeq: (worker: WorkerId | "swarm") => number,
  options: MockRunOptions,
): Promise<WorkerOutcome> {
  const base = { worker, mock: true as const };
  const seq = (): number => nextSeq(worker);
  const normalized = normalizeWorkerResult(
    worker,
    mockResult(worker, input),
    WORKER_SOURCES[worker],
  );
  const timeline = createMockTimeline(worker, input, options);

  emit({
    event: "worker_started",
    data: {
      ...base,
      seq: seq(),
      ts: tsNow(),
      runId: `mock_${worker}`,
      startedAt: tsNow(),
    },
  });
  emit({
    event: "streaming_url",
    data: {
      ...base,
      seq: seq(),
      ts: tsNow(),
      streamingUrl: `/mock-browser/${worker}`,
    },
  });

  let elapsed = 0;
  for (const entry of timeline) {
    await sleep(Math.max(entry.atMs - elapsed, 0));
    elapsed = entry.atMs;
    if (entry.kind === "progress") {
      emit({
        event: "worker_progress",
        data: {
          ...base,
          seq: seq(),
          ts: tsNow(),
          purpose: entry.purpose ?? "Reading the page",
          ...(entry.api === undefined ? {} : { tinyfishApi: entry.api }),
        },
      });
    } else if (entry.kind === "sources" && entry.items !== undefined) {
      emit({
        event: "worker_sources",
        data: { ...base, seq: seq(), ts: tsNow(), items: entry.items },
      });
    } else if (entry.kind === "heartbeat") {
      emit({ event: "worker_heartbeat", data: { ...base, seq: seq(), ts: tsNow() } });
    } else if (entry.kind === "fail") {
      emit({
        event: "worker_error",
        data: {
          ...base,
          seq: seq(),
          ts: tsNow(),
          code: "site_blocked",
          message: "The site blocked the agent. Retry this check.",
        },
      });
      return { worker, ok: false };
    } else if (entry.kind === "complete") {
      emit({
        event: "worker_complete",
        data: {
          ...base,
          seq: seq(),
          ts: tsNow(),
          findings: normalized.findings,
          sourceUrl: normalized.sourceUrl,
          retrievedAt: tsNow(),
        },
      });
      return { worker, ok: true };
    }
  }
  return { worker, ok: false };
}
