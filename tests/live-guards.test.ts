/**
 * Route-level proof of the live-run guards: kill switch, closed billing, cooldowns, and
 * the per-account daily venue cap. No model, browser, or database is called.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as planPost } from "@/app/api/agent-plan/route";
import { POST as swarmPost } from "@/app/api/travel-swarm/route";
import { POST as venuePost } from "@/app/api/venue-research/route";
import { resetLiveLimitsForTests } from "@/lib/liveLimits";

const plannerBody = {
  destination: "Lisbon, Portugal",
  days: 4,
  condition: "asthma_respiratory",
  interests: "quiet food",
  budget: "balanced",
};

const swarmBody = {
  destination: "Lisbon, Portugal",
  condition: "asthma_respiratory",
};

const venueBody = {
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

function post(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function stubLiveDefaults(): void {
  vi.stubEnv("AGENT_MOCK", "");
  vi.stubEnv("SWARM_MOCK", "");
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("PLANMYTRIP_LIVE_DISABLED", "");
  vi.stubEnv("PLANMYTRIP_PLANNER_COOLDOWN_SEC", "0");
  vi.stubEnv("PLANMYTRIP_SWARM_COOLDOWN_SEC", "0");
  vi.stubEnv("PLANMYTRIP_VENUE_COOLDOWN_SEC", "0");
  resetLiveLimitsForTests();
}

beforeEach(() => {
  stubLiveDefaults();
});

afterEach(() => {
  resetLiveLimitsForTests();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("live-run guards", () => {
  it("returns 503 for every live surface when the kill switch is on", async () => {
    vi.stubEnv("PLANMYTRIP_LIVE_DISABLED", "1");

    for (const [response, path] of [
      [await planPost(post("/api/agent-plan", plannerBody)), "agent-plan"],
      [await swarmPost(post("/api/travel-swarm", swarmBody)), "travel-swarm"],
      [await venuePost(post("/api/venue-research", venueBody)), "venue-research"],
    ] as const) {
      expect(response.status, path).toBe(503);
      await expect(response.json()).resolves.toMatchObject({
        code: "live_disabled",
      });
    }
  });

  it("fails closed when the plan reservation cannot reach the database", async () => {
    const response = await planPost(post("/api/agent-plan", plannerBody));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "billing_unavailable",
    });
  });

  it("returns 429 during the swarm cooldown", async () => {
    vi.stubEnv("TINYFISH_API_KEY", "");
    vi.stubEnv("PLANMYTRIP_SWARM_COOLDOWN_SEC", "5");
    resetLiveLimitsForTests();

    const first = await swarmPost(post("/api/travel-swarm", swarmBody));
    expect(first.status).toBe(200);
    await first.text();

    const second = await swarmPost(post("/api/travel-swarm", swarmBody));
    expect(second.status).toBe(429);
    expect(Number(second.headers.get("retry-after"))).toBeGreaterThan(0);
    await expect(second.json()).resolves.toMatchObject({ code: "rate_limited" });
  });

  it("returns 429 during the venue cooldown", async () => {
    vi.stubEnv("TINYFISH_API_KEY", "");
    vi.stubEnv("PLANMYTRIP_VENUE_COOLDOWN_SEC", "5");
    resetLiveLimitsForTests();

    const first = await venuePost(post("/api/venue-research", venueBody));
    expect(first.status).toBe(200);
    await first.text();

    const second = await venuePost(post("/api/venue-research", venueBody));
    expect(second.status).toBe(429);
    expect(Number(second.headers.get("retry-after"))).toBeGreaterThan(0);
    await expect(second.json()).resolves.toMatchObject({ code: "rate_limited" });
  });

  it("enforces the venue daily cap even after the cooldown passes", async () => {
    vi.stubEnv("TINYFISH_API_KEY", "");
    vi.stubEnv("PLANMYTRIP_VENUE_COOLDOWN_SEC", "0");
    vi.stubEnv("PLANMYTRIP_VENUE_DAILY_LIMIT", "1");
    resetLiveLimitsForTests();

    const first = await venuePost(post("/api/venue-research", venueBody));
    expect(first.status).toBe(200);
    await first.text();

    const second = await venuePost(post("/api/venue-research", venueBody));
    expect(second.status).toBe(429);
    const body = (await second.json()) as { error?: string };
    expect(body.error).toContain("daily");
  });
});
