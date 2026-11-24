import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/billing/server", () => ({
  readBilling: async () => ({
    userId: "user-free-1",
    entitlements: {
      plan: "free_user",
      tripsPerPeriod: 1,
      tripPeriod: "year",
      maxTripDays: 7,
      savedTripLimit: 1,
      liveVerification: false,
      venueResearch: false,
    },
  }),
}));

import { POST as planPost } from "@/app/api/agent-plan/route";
import { POST as venuePost } from "@/app/api/venue-research/route";
import { POST as swarmPost } from "@/app/api/travel-swarm/route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("free-plan server gates", () => {
  it("rejects a trip longer than the free ceiling", async () => {
    const response = await planPost(
      jsonRequest({
        destination: "Tokyo, Japan",
        origin: "Toronto, Canada",
        days: 20,
        condition: "asthma_respiratory",
        medication: "albuterol inhaler",
        interests: "",
        budget: "balanced",
        transport: "mixed",
        runId: "run-12345678",
        installId: "install-12345678",
      }),
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "plan_limit",
    });
  });

  it("rejects live verification without the feature", async () => {
    const response = await swarmPost(
      jsonRequest({
        destination: "Tokyo, Japan",
        condition: "asthma_respiratory",
        medication: "albuterol inhaler",
      }),
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "upgrade_required",
    });
  });

  it("rejects venue research without the feature", async () => {
    const response = await venuePost(jsonRequest({}));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "upgrade_required",
    });
  });
});
