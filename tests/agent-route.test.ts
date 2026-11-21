import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/agent-plan/route";

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
      const dataText = lines.find((line) => line.startsWith("data:"))?.slice(5).trim() ?? "{}";
      return { event, data: JSON.parse(dataText) as Record<string, unknown> };
    });
}

const body = {
  destination: "Lisbon, Portugal",
  days: 4,
  condition: "asthma_respiratory",
  medication: "albuterol",
  interests: "quiet food",
  budget: "balanced",
};

describe("POST /api/agent-plan", () => {
  const previous = process.env.AGENT_MOCK;
  beforeAll(() => {
    process.env.AGENT_MOCK = "1";
  });
  afterAll(() => {
    if (previous === undefined) delete process.env.AGENT_MOCK;
    else process.env.AGENT_MOCK = previous;
  });

  it("streams a complete mock concierge run", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/agent-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    const frames = parseFrames(await response.text());
    expect(frames[0]?.event).toBe("planner_started");
    expect(frames.at(-1)?.event).toBe("planner_done");
    expect(frames.every((frame) => frame.data.mock === true)).toBe(true);
    expect(frames.filter((frame) => frame.event === "agent_started")).toHaveLength(7);
    expect(frames.some((frame) => frame.event === "agent_activity")).toBe(true);

    const ready = frames.find((frame) => frame.event === "plan_ready");
    expect(ready).toBeDefined();
    const plan = ready?.data.plan as {
      days: unknown[];
      places: Array<{ lat: number | null; lng: number | null }>;
      mock?: boolean;
    };
    expect(plan.days).toHaveLength(4);
    expect(plan.places.length).toBeGreaterThan(0);
    expect(plan.places.some((place) => place.lat !== null && place.lng !== null)).toBe(
      true,
    );
    expect(plan.mock).toBe(true);
  });

  it("rejects an invalid request body with JSON", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/agent-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, days: 20 }),
      }),
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    await expect(response.json()).resolves.toMatchObject({ error: expect.any(String) });
  });

  it("rejects a body that is not JSON", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/agent-plan", {
        method: "POST",
        body: "not json",
      }),
    );
    expect(response.status).toBe(400);
  });
});
