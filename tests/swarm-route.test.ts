import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/travel-swarm/route";
import { resetLiveLimitsForTests } from "@/lib/liveLimits";
import { WORKER_SCHEMAS, WORKER_SOURCES } from "@/lib/swarmGoals";
import { WORKER_TIMEOUT_MS } from "@/lib/swarmRunner";
import type { WorkerId } from "@/lib/swarmTypes";
import {
  BODY,
  FINDINGS,
  SECRET,
  completedFrames,
  installFetch,
  lastFrame,
  makeRequest,
  parseFrames,
  readResponse,
  sseResponse,
  workerFromUrl,
} from "./swarm-route-fixtures";

afterEach(() => {
  resetLiveLimitsForTests();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("POST /api/travel-swarm", () => {
  it("returns 400 JSON for invalid bodies", async () => {
    const invalidBodies: unknown[] = [
      {},
      { ...BODY, destination: "   " },
      { ...BODY, condition: "not_a_condition" },
      { ...BODY, workers: [] },
      { ...BODY, workers: ["advisory", "unknown"] },
      { ...BODY, condition: 42 },
    ];
    for (const body of invalidBodies) {
      const response = await POST(makeRequest(body));
      expect(response.status).toBe(400);
      expect(response.headers.get("content-type")).toContain("application/json");
      const json = (await response.json()) as { error?: string };
      expect(typeof json.error).toBe("string");
    }

    const malformed = await POST(
      new Request("http://localhost/api/travel-swarm", {
        method: "POST",
        body: "{not json",
      }),
    );
    expect(malformed.status).toBe(400);
  });

  it("streams a missing_api_key error, then swarm_done, without fetching", async () => {
    vi.stubEnv("TINYFISH_API_KEY", "");
    vi.stubEnv("SWARM_MOCK", "");
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(makeRequest(BODY));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-cache, no-transform");
    expect(response.headers.get("x-accel-buffering")).toBe("no");

    const frames = parseFrames(await readResponse(response));
    expect(fetchMock).not.toHaveBeenCalled();
    const errors = frames.filter((frame) => frame.event === "worker_error");
    expect(errors.map((frame) => frame.data.worker)).toEqual(["advisory"]);
    expect(errors.every((frame) => frame.data.code === "missing_api_key")).toBe(true);
    expect(frames.some((frame) => frame.event === "worker_complete")).toBe(false);
    expect(lastFrame(frames).event).toBe("swarm_done");
    expect(lastFrame(frames).data).toMatchObject({
      worker: "swarm",
      completed: [],
      failed: ["advisory"],
    });
  });

  it("completes the worker, sends its schema, and never echoes the key", async () => {
    vi.stubEnv("TINYFISH_API_KEY", SECRET);
    vi.stubEnv("SWARM_MOCK", "");
    const fetchMock = installFetch((worker) => sseResponse(completedFrames(worker)));

    const response = await POST(makeRequest(BODY));
    expect(response.status).toBe(200);
    const text = await readResponse(response);
    expect(text).not.toContain(SECRET);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    for (const [, init] of fetchMock.mock.calls) {
      const requestBody = JSON.parse(String(init?.body)) as {
        goal: string;
        url: string;
        output_schema: unknown;
      };
      const worker = workerFromUrl(requestBody.url);
      expect(new Headers(init?.headers).get("x-api-key")).toBe(SECRET);
      expect(requestBody.output_schema).toEqual(WORKER_SCHEMAS[worker]);
      expect(requestBody.goal).toContain("Lisbon, Portugal");
      expect(requestBody.goal).toContain("asthma");
      expect(requestBody.goal).not.toContain("medication");
      expect(requestBody.goal).toContain("Return only JSON");
    }

    const frames = parseFrames(text);
    const completes = frames.filter((frame) => frame.event === "worker_complete");
    expect(completes).toHaveLength(1);
    for (const frame of completes) {
      const worker = frame.data.worker as WorkerId;
      expect(frame.data.findings).toEqual(FINDINGS[worker]);
      expect(frame.data.sourceUrl).toBe(WORKER_SOURCES[worker]);
      expect(frame.data.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
    expect(lastFrame(frames).event).toBe("swarm_done");
    expect(lastFrame(frames).data).toMatchObject({
      completed: ["advisory"],
      failed: [],
    });
  });

  it("turns an upstream failure into a calm worker error", async () => {
    vi.stubEnv("TINYFISH_API_KEY", SECRET);
    vi.stubEnv("SWARM_MOCK", "");
    installFetch(() => new Response("upstream exploded", { status: 503 }));

    const response = await POST(makeRequest(BODY));
    expect(response.status).toBe(200);
    const frames = parseFrames(await readResponse(response));

    const errors = frames.filter((frame) => frame.event === "worker_error");
    expect(errors).toHaveLength(1);
    expect(errors[0].data).toMatchObject({
      worker: "advisory",
      code: "upstream_error",
    });
    expect(errors[0].data.message).toBeTypeOf("string");
    expect(frames.some((frame) => frame.event === "worker_complete")).toBe(false);
    expect(lastFrame(frames).data).toMatchObject({
      completed: [],
      failed: ["advisory"],
    });
  });

  it("runs the requested advisory worker", async () => {
    vi.stubEnv("TINYFISH_API_KEY", SECRET);
    vi.stubEnv("SWARM_MOCK", "");
    const fetchMock = installFetch((worker) => sseResponse(completedFrames(worker)));

    const response = await POST(makeRequest({ ...BODY, workers: ["advisory"] }));
    const frames = parseFrames(await readResponse(response));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(frames.filter((frame) => frame.event === "worker_complete").map((frame) => frame.data.worker)).toEqual([
      "advisory",
    ]);
    expect(lastFrame(frames).data).toMatchObject({
      completed: ["advisory"],
      failed: [],
    });
  });

  it("emits mock events tagged mock:true in development mock mode", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SWARM_MOCK", "1");
    vi.stubEnv("SWARM_MOCK_SPEED", "50");
    vi.stubEnv("TINYFISH_API_KEY", "");
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(makeRequest(BODY));
    expect(response.status).toBe(200);
    const frames = parseFrames(await readResponse(response));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every((frame) => frame.data.mock === true)).toBe(true);
    const streaming = frames.filter((frame) => frame.event === "streaming_url");
    expect(streaming.map((frame) => frame.data.streamingUrl)).toEqual([
      "/mock-browser/advisory",
    ]);
    expect(lastFrame(frames).event).toBe("swarm_done");
    expect(lastFrame(frames).data.mock).toBe(true);
    expect(lastFrame(frames).data.summary).toMatchObject({ findings: 1 });

    const names = frames.map((frame) => frame.event);
    expect(names[0]).toBe("worker_status");
    expect(names.indexOf("worker_started")).toBeLessThan(names.indexOf("streaming_url"));
    for (const worker of ["advisory"] as const) {
      const workerFrames = frames.filter((frame) => frame.data.worker === worker);
      const seq = workerFrames.map((frame) => frame.data.seq);
      expect(seq).toEqual([...seq].sort((left, right) => Number(left) - Number(right)));
      expect(new Set(seq).size).toBe(seq.length);
      expect(workerFrames.some((frame) => frame.event === "worker_progress")).toBe(true);
      expect(workerFrames.some((frame) => frame.event === "worker_sources")).toBe(true);
      const completeIndex = workerFrames.findIndex(
        (frame) => frame.event === "worker_complete",
      );
      expect(completeIndex).toBeGreaterThan(0);
    }
  });

  it("ignores mock mode in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SWARM_MOCK", "1");
    vi.stubEnv("TINYFISH_API_KEY", "");
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const frames = parseFrames(await readResponse(await POST(makeRequest(BODY))));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(frames.filter((frame) => frame.event === "worker_error")).toHaveLength(1);
    expect(frames.some((frame) => frame.data.mock === true)).toBe(false);
  });

  it("times out a stalled upstream and still ends with swarm_done", async () => {
    vi.useFakeTimers();
    vi.stubEnv("TINYFISH_API_KEY", SECRET);
    vi.stubEnv("SWARM_MOCK", "");
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(makeRequest({ ...BODY, workers: ["advisory"] }));
    expect(response.status).toBe(200);
    if (response.body === null) throw new Error("response should have a body");
    const readPromise = readResponse(response);
    await vi.advanceTimersByTimeAsync(WORKER_TIMEOUT_MS + 500);
    const frames = parseFrames(await readPromise);
    expect(frames.filter((frame) => frame.event === "worker_error")).toHaveLength(1);
    const error = frames.find((frame) => frame.event === "worker_error");
    expect(error?.data).toMatchObject({ worker: "advisory", code: "timeout" });
    expect(lastFrame(frames).event).toBe("swarm_done");
  });
});
