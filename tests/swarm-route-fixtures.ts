/**
 * Shared fixtures for the travel-swarm route tests. No network: every helper builds
 * local Request/Response objects, and installFetch stubs the global fetch.
 */

import { vi } from "vitest";
import { WORKER_SOURCES } from "@/lib/swarmGoals";
import type { WorkerId } from "@/lib/swarmTypes";

export const NOW = "2026-11-21T12:00:00.000Z";
export const SECRET = "tf_live_test_secret_should_never_appear";
export const BODY = {
  destination: "Lisbon, Portugal",
  condition: "asthma_respiratory",
  medication: "albuterol inhaler",
};

export const FINDINGS: Record<WorkerId, Record<string, unknown>> = {
  advisory: {
    destinationRiskLevel: "Exercise a high degree of caution",
    riskSummary: "Avoid large gatherings.",
    healthNotices: ["Measles outbreak reported."],
    environmentalHazards: ["Summer heat and poor air quality."],
  },
  pharmacy: {
    genericName: "albuterol",
    localBrandNames: ["Ventolin"],
    customsRules: "Carry a copy of the prescription.",
    carryRules: "Keep the inhaler in hand luggage.",
  },
  coverage: {
    emergencyMedicalLimit: "Mock limit: CAD 5,000,000.",
    preAuthorizationRules: "Call before non-emergency care.",
    checklist: [{ item: "Carry your policy card.", source: "page" }],
  },
};

export interface SseFrame {
  event: string;
  data: Record<string, unknown>;
}

export function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/travel-swarm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function readResponse(response: Response): Promise<string> {
  if (response.body === null) throw new Error("response should have a body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

export function parseFrames(text: string): SseFrame[] {
  return text.split("\n\n").flatMap((block) => {
    const lines = block.split("\n").filter((line) => line.length > 0);
    const event = lines.find((line) => line.startsWith("event: "));
    const data = lines
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.slice("data: ".length))
      .join("\n");
    if (event === undefined || data === "") return [];
    return [
      {
        event: event.slice("event: ".length),
        data: JSON.parse(data) as Record<string, unknown>,
      },
    ];
  });
}

export function sseResponse(frames: unknown[]): Response {
  const body = frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join("");
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

export function workerFromUrl(url: string): WorkerId {
  const entry = (Object.entries(WORKER_SOURCES) as Array<[WorkerId, string]>).find(
    ([, source]) => source === url,
  );
  if (entry === undefined) throw new Error(`unexpected worker URL: ${url}`);
  return entry[0];
}

export function completedFrames(worker: WorkerId): unknown[] {
  return [
    { type: "STARTED", run_id: `run_${worker}`, timestamp: NOW },
    {
      type: "STREAMING_URL",
      run_id: `run_${worker}`,
      streaming_url: `https://preview.invalid/${worker}`,
      timestamp: NOW,
    },
    {
      type: "PROGRESS",
      run_id: `run_${worker}`,
      purpose: `Checking ${worker}`,
      timestamp: NOW,
    },
    {
      type: "COMPLETE",
      run_id: `run_${worker}`,
      status: "COMPLETED",
      result: { ...FINDINGS[worker], sourceUrl: WORKER_SOURCES[worker] },
      timestamp: NOW,
    },
  ];
}

export function installFetch(handler: (worker: WorkerId) => Response) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof init?.body === "string" ? init.body : "{}";
    const body = JSON.parse(raw) as { url?: string };
    if (typeof body.url !== "string") throw new Error("request body should include a URL");
    return handler(workerFromUrl(body.url));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function lastFrame(frames: SseFrame[]): SseFrame {
  const frame = frames[frames.length - 1];
  if (frame === undefined) throw new Error("expected at least one SSE frame");
  return frame;
}
