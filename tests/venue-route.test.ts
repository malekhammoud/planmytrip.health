import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/venue-research/route";

interface Frame {
  event: string;
  data: Record<string, unknown>;
}

function parseFrames(text: string): Frame[] {
  return text
    .split("\n\n")
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.startsWith("event:"))
    .map((chunk) => {
      const lines = chunk.split("\n");
      const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim() ?? "";
      const data = lines.find((line) => line.startsWith("data:"))?.slice(5).trim() ?? "{}";
      return { event, data: JSON.parse(data) as Record<string, unknown> };
    });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

const body = {
  destination: "London, Ontario",
  checkIn: "2026-12-10",
  days: 4,
  travelers: 2,
  places: [
    {
      id: "place-1",
      name: "The Cafe",
      category: "eat",
      sourceUrl: "https://example.com/menu",
    },
  ],
};

describe("POST /api/venue-research", () => {
  it("fails each worker cleanly when TinyFish is not configured", async () => {
    vi.stubEnv("TINYFISH_API_KEY", "");
    const response = await POST(
      new Request("http://localhost/api/venue-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    const frames = parseFrames(await response.text());
    expect(frames[0]?.event).toBe("venue_started");
    expect(frames.some((frame) => frame.event === "venue_error")).toBe(true);
    const last = frames[frames.length - 1];
    expect(last?.event).toBe("venue_done");
    expect(last?.data).toMatchObject({ completed: [], failed: ["place-1"] });
  });

  it("rejects an invalid body", async () => {
    const response = await POST(
      new Request("http://localhost/api/venue-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, places: [] }),
      }),
    );
    expect(response.status).toBe(400);
  });
});
