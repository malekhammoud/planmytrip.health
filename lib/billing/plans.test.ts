import { describe, expect, it } from "vitest";
import {
  BILLING_FEATURES,
  billingPeriodStart,
  entitlementsFromHas,
  FREE_MAX_TRIP_DAYS,
  isPaidPlan,
  planLabel,
} from "./plans";

function has(enabled: readonly string[]): (params: {
  plan?: string;
  feature?: string;
}) => boolean {
  return ({ plan, feature }) => {
    const key = plan ?? feature ?? "";
    return enabled.includes(key);
  };
}

describe("billing entitlements", () => {
  it("falls back to the free limits when no claim matches", () => {
    const value = entitlementsFromHas(has([]));
    expect(value).toEqual({
      plan: "free_user",
      tripsPerPeriod: 1,
      tripPeriod: "year",
      maxTripDays: FREE_MAX_TRIP_DAYS,
      savedTripLimit: 1,
      liveVerification: false,
      venueResearch: false,
    });
  });

  it("maps a paid plan and its features", () => {
    const value = entitlementsFromHas(
      has([
        "care_circle",
        BILLING_FEATURES.longTrips,
        BILLING_FEATURES.liveVerification,
        BILLING_FEATURES.venueResearch,
        BILLING_FEATURES.unlimitedSavedTrips,
      ]),
    );
    expect(value.plan).toBe("care_circle");
    expect(value.tripsPerPeriod).toBe(2);
    expect(value.tripPeriod).toBe("month");
    expect(value.maxTripDays).toBe(20);
    expect(value.savedTripLimit).toBeNull();
    expect(value.liveVerification).toBe(true);
    expect(value.venueResearch).toBe(true);
  });

  it("does not widen a cap without the long-trips feature", () => {
    const value = entitlementsFromHas(
      has(["care_circle", BILLING_FEATURES.liveVerification]),
    );
    expect(value.plan).toBe("care_circle");
    expect(value.tripsPerPeriod).toBe(2);
    expect(value.tripPeriod).toBe("month");
    expect(value.maxTripDays).toBe(FREE_MAX_TRIP_DAYS);
    expect(value.savedTripLimit).toBe(1);
  });

  it("treats a throwing has() as free", () => {
    const value = entitlementsFromHas(() => {
      throw new Error("billing disabled");
    });
    expect(value.plan).toBe("free_user");
    expect(value.liveVerification).toBe(false);
  });

  it("labels plans and identifies paid tiers", () => {
    expect(planLabel("free_user")).toBe("Free Preview");
    expect(planLabel("care_circle")).toBe("Care Circle");
    expect(isPaidPlan("free_user")).toBe(false);
    expect(isPaidPlan("care_circle")).toBe(true);
  });

  it("computes monthly and yearly allowance starts in UTC", () => {
    const now = new Date("2026-11-23T23:30:00.000Z");
    expect(billingPeriodStart("month", now)).toBe("2026-11-01");
    expect(billingPeriodStart("year", now)).toBe("2026-01-01");
    expect(billingPeriodStart("month", new Date("2027-01-01T00:00:00.000Z"))).toBe(
      "2027-01-01",
    );
  });
});
