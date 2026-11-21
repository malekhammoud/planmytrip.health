/**
 * TinyFish client and SSE parser tests.
 *
 * All fetch calls are mocked; no network or real API key is used.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { createSseParser } from "./sse";
import {
  TINYFISH_RUN_SSE_URL,
  TinyfishHttpError,
  createSseParser as createSseParserReExport,
  parseTinyfishEvent,
  streamTinyfishRun,
} from "./tinyfish";

describe("createSseParser", () => {
  it("is re-exported from the TinyFish module for existing imports", () => {
    expect(createSseParserReExport).toBe(createSseParser);
  });

  it("holds a split frame until the blank line arrives", () => {
    const parser = createSseParser();
    expect(parser.push('data: {"type":"STA')).toEqual([]);
    expect(parser.push('RTED"}\n')).toEqual([]);
    expect(parser.push("\n")).toEqual([{ data: '{"type":"STARTED"}' }]);
  });

  it("handles CRLF split across chunks", () => {
    const parser = createSseParser();
    expect(parser.push("event: worker_status\r")).toEqual([]);
    expect(parser.push("\ndata: one\r\n\r\n")).toEqual([
      { event: "worker_status", data: "one" },
    ]);
  });

  it("joins multi-line data and ignores comments and unknown fields", () => {
    const parser = createSseParser();
    expect(
      parser.push(": keep-alive\n\ndata: first\ndata: second\n\ndata: third\n\n"),
    ).toEqual([{ data: "first\nsecond" }, { data: "third" }]);
  });

  it("keeps event and id fields and ignores retry", () => {
    const parser = createSseParser();
    expect(
      parser.push("id: 7\nevent: custom\nretry: 1000\ndata: value\n\n"),
    ).toEqual([{ data: "value", event: "custom", id: "7" }]);
  });

  it("flushes a final frame that has no trailing blank line", () => {
    const parser = createSseParser();
    expect(parser.push("data: final")).toEqual([]);
    expect(parser.flush()).toEqual([{ data: "final" }]);
    expect(parser.flush()).toEqual([]);
  });
});

describe("parseTinyfishEvent", () => {
  it("returns null for invalid JSON and unknown event types", () => {
    expect(parseTinyfishEvent("not json")).toBeNull();
    expect(parseTinyfishEvent(JSON.stringify({ type: "FUTURE_EVENT" }))).toBeNull();
    expect(parseTinyfishEvent(JSON.stringify(["array"]))).toBeNull();
  });

  it("normalises the documented event fields", () => {
    expect(
      parseTinyfishEvent(
        JSON.stringify({
          type: "COMPLETE",
          run_id: "run_1",
          status: "FAILED",
          error: { message: "page blocked" },
          result: "raw",
          timestamp: "2026-11-21T00:00:00.000Z",
        }),
      ),
    ).toEqual({
      type: "COMPLETE",
      runId: "run_1",
      timestamp: "2026-11-21T00:00:00.000Z",
      status: "FAILED",
      result: "raw",
      error: "page blocked",
      helpUrl: null,
      helpMessage: null,
    });
  });
});

function sseResponse(frames: unknown[]): Response {
  const body = frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join("");
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("streamTinyfishRun", () => {
  it("sends the key in the header, sends the schema, and emits parsed events", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => sseResponse([
      { type: "STARTED", run_id: "run_1", timestamp: "2026-11-21T00:00:00.000Z" },
      { type: "PROGRESS", run_id: "run_1", purpose: "Reading", timestamp: "2026-11-21T00:00:01.000Z" },
      { type: "HEARTBEAT", timestamp: "2026-11-21T00:00:02.000Z" },
    ]));
    vi.stubGlobal("fetch", fetchMock);

    const events: string[] = [];
    await streamTinyfishRun({
      apiKey: "test-key-not-real",
      url: "https://example.test/page",
      goal: "Return only JSON.",
      outputSchema: { type: "object", properties: {} },
      onEvent: (event) => events.push(event.type),
    });

    expect(events).toEqual(["STARTED", "PROGRESS", "HEARTBEAT"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0];
    expect(String(input)).toBe(TINYFISH_RUN_SSE_URL);
    const headers = new Headers(init?.headers);
    expect(headers.get("x-api-key")).toBe("test-key-not-real");
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body.url).toBe("https://example.test/page");
    expect(body.goal).toBe("Return only JSON.");
    expect(body.output_schema).toEqual({ type: "object", properties: {} });
  });

  it("throws a status-only error for a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 503 })));
    await expect(
      streamTinyfishRun({
        apiKey: "test-key-not-real",
        url: "https://example.test/page",
        goal: "Return only JSON.",
        onEvent: () => {},
      }),
    ).rejects.toBeInstanceOf(TinyfishHttpError);
  });
});
