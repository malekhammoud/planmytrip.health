/**
 * Retry-path tests for the live worker runner. All fetch calls are mocked; no network
 * or real API key is used.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { SWARM_RETRY_NOTES } from "@/lib/swarmConfig";
import { WORKER_SCHEMAS, WORKER_SOURCES } from "@/lib/swarmGoals";
import { runSwarm } from "@/lib/swarmRunner";
import type { SwarmEvent } from "@/lib/swarmTypes";
import { FINDINGS, NOW, sseResponse } from "./swarm-route-fixtures";

const input = {
  destination: "Lisbon, Portugal",
  condition: "asthma_respiratory" as const,
  medication: "albuterol inhaler",
};

const completed = [
  { type: "STARTED", run_id: "run_retry", timestamp: NOW },
  {
    type: "COMPLETE",
    run_id: "run_retry",
    status: "COMPLETED",
    result: { ...FINDINGS.advisory, sourceUrl: WORKER_SOURCES.advisory },
    timestamp: NOW,
  },
];

function requestBody(init?: RequestInit): Record<string, unknown> {
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("live worker retries", () => {
  it("retries once without output_schema after INVALID_INPUT", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: "INVALID_INPUT" } }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(sseResponse(completed));
    vi.stubGlobal("fetch", fetchMock);

    const events: SwarmEvent[] = [];
    await runSwarm(
      ["advisory"],
      { input, apiKey: "test-key", emit: (event) => events.push(event), signal: new AbortController().signal },
      false,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestBody(fetchMock.mock.calls[0]?.[1]).output_schema).toEqual(
      WORKER_SCHEMAS.advisory,
    );
    expect(requestBody(fetchMock.mock.calls[1]?.[1]).output_schema).toBeUndefined();
    const notes = events.filter((event) => event.event === "worker_note");
    expect(notes).toHaveLength(1);
    expect(notes[0]?.data.message).toBe(SWARM_RETRY_NOTES.schema);
    expect(events.filter((event) => event.event === "worker_complete")).toHaveLength(1);
    expect(events[events.length - 1]?.event).toBe("swarm_done");
  });

  it("retries once with the stealth browser after SITE_BLOCKED", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: "SITE_BLOCKED" } }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(sseResponse(completed));
    vi.stubGlobal("fetch", fetchMock);

    const events: SwarmEvent[] = [];
    await runSwarm(
      ["advisory"],
      { input, apiKey: "test-key", emit: (event) => events.push(event), signal: new AbortController().signal },
      false,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestBody(fetchMock.mock.calls[0]?.[1]).browser_profile).toBeUndefined();
    expect(requestBody(fetchMock.mock.calls[1]?.[1]).browser_profile).toBe("stealth");
    // The schema survives a stealth retry; only INVALID_INPUT drops it.
    expect(requestBody(fetchMock.mock.calls[1]?.[1]).output_schema).toEqual(
      WORKER_SCHEMAS.advisory,
    );
    const notes = events.filter((event) => event.event === "worker_note");
    expect(notes[0]?.data.message).toBe(SWARM_RETRY_NOTES.stealth);
    expect(events.filter((event) => event.event === "worker_complete")).toHaveLength(1);
  });

  it("fails once with site_blocked when the stealth retry is blocked too", async () => {
    const blocked = () =>
      new Response(JSON.stringify({ error: { code: "SITE_BLOCKED" } }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(blocked())
      .mockResolvedValueOnce(blocked());
    vi.stubGlobal("fetch", fetchMock);

    const events: SwarmEvent[] = [];
    await runSwarm(
      ["advisory"],
      { input, apiKey: "test-key", emit: (event) => events.push(event), signal: new AbortController().signal },
      false,
    );

    const errors = events.filter((event) => event.event === "worker_error");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.data.code).toBe("site_blocked");
    expect(events.filter((event) => event.event === "worker_complete")).toHaveLength(0);
    expect(events[events.length - 1]?.event).toBe("swarm_done");
  });
});
