import { describe, expect, it } from "vitest";
import {
  campaignFor,
  cityName,
  countryName,
  destinationKey,
  destinationParts,
  featuredDestination,
  plannerHref,
  safeDestination,
  signUpHref,
  timezoneDestination,
} from "@/lib/ads/campaign";
import { parseAdClick } from "@/lib/ads/clickEvent";

describe("ad destination copy", () => {
  it("cleans a destination and rejects unusable values", () => {
    expect(safeDestination("  Paris,\u0000 France  ")).toBe("Paris, France");
    expect(safeDestination("   ")).toBeNull();
    expect(safeDestination("a".repeat(141))).toBeNull();
    expect(safeDestination(7)).toBeNull();
    expect(safeDestination("Paris 🗼")).toBe("Paris");
    expect(safeDestination("東京")).toBe("東京");
    expect(safeDestination("!!!")).toBeNull();
  });

  it("splits a city, region, and country", () => {
    expect(destinationParts("Paris, Île-de-France, France")).toEqual({
      city: "Paris",
      country: "France",
      segments: ["Paris", "Île-de-France", "France"],
    });
    expect(cityName("paris")).toBe("Paris");
    expect(countryName("London, United Kingdom")).toBe("United Kingdom");
    expect(cityName("MEXICO CITY")).toBe("Mexico City");
    expect(destinationKey("São Paulo")).toBe("sao paulo");
  });

  it("uses the Paris note only for the French Paris", () => {
    const paris = campaignFor("Paris, France", "plan");
    expect(paris.headline).toBe("Looking for a health trip to Paris?");
    expect(paris.copy).toContain("Seine-side walks");
    expect(paris.ctaLabel).toBe("Plan Paris");
    expect(paris.rows[0]).toEqual({ term: "Destination", detail: "Paris, France" });
    expect(paris.issue).toMatch(/^\d{2}$/);

    const texas = campaignFor("Paris, Texas, United States", "plan");
    expect(texas.city).toBe("Paris");
    expect(texas.copy).not.toContain("Seine-side walks");
    expect(texas.copy).toContain("We've got you covered.");
  });

  it("does not borrow London, England copy for London, Ontario", () => {
    const ontario = campaignFor("London, Ontario, Canada", "plan");
    expect(ontario.copy).not.toContain("Museum mornings");
    const england = campaignFor("London, United Kingdom", "plan");
    expect(england.copy).toContain("Museum mornings");
    expect(campaignFor("Paris, FR", "plan").copy).toContain("Seine-side walks");
    expect(campaignFor("Rome, GA", "plan").copy).not.toContain("Ancient streets");
  });

  it("keeps the generic copy safe for an unknown city", () => {
    const campaign = campaignFor("A small town without a note", "plan");
    expect(campaign.headline).toContain("A small town without a note");
    expect(campaign.copy).toContain("A day-by-day plan paced around your health");
    expect(campaign.finePrint).toBe("Planning aid only. Not medical advice.");
  });

  it("shortens a very long destination and its CTA", () => {
    const campaign = campaignFor("A".repeat(120), "plan");
    expect(campaign.city.length).toBeLessThanOrEqual(36);
    expect(campaign.city.endsWith("...")).toBe(true);
    expect(campaign.ctaLabel).toBe("Plan this trip");
    expect(campaign.rows[0].detail.length).toBeLessThanOrEqual(64);
  });

  it("builds the Care Circle campaign with live-check rows", () => {
    const campaign = campaignFor("Mexico City, Mexico", "upgrade");
    expect(campaign.headline).toBe("The Mexico City plan, with live checks.");
    expect(campaign.ctaLabel).toBe("See Care Circle");
    expect(campaign.copy).toContain("Mexico City");
    expect(campaign.rows.some((row) => row.term === "Price")).toBe(true);
  });

  it("swaps in report copy for a finished trip", () => {
    const upgrade = campaignFor("Paris, France", "upgrade", "report");
    expect(upgrade.headline).toBe("Make this Paris report current.");
    expect(upgrade.copy).toContain("for this trip");
    const plan = campaignFor("Paris, France", "plan", "report");
    expect(plan.headline).toBe("Plan another Paris trip.");
    expect(plan.ctaLabel).toBe("Plan another trip");
    expect(plan.finePrint).toBe("Planning aid only. Not medical advice.");
  });

  it("falls back to a featured destination for an empty value", () => {
    const campaign = campaignFor("", "plan");
    expect(campaign.destination).toBe("Paris, France");
    expect(campaign.headline).toContain("Paris");
  });

  it("rotates the featured destination by UTC day and is deterministic", () => {
    const first = featuredDestination(new Date("2026-11-25T12:00:00Z"));
    const second = featuredDestination(new Date("2026-11-25T23:59:00Z"));
    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(0);
  });

  it("maps common time zones and ignores unknown zones", () => {
    expect(timezoneDestination("Europe/Paris")).toBe("Paris, France");
    expect(timezoneDestination("Asia/Tokyo")).toBe("Tokyo, Japan");
    expect(timezoneDestination("Pacific/Nowhere")).toBeNull();
    expect(timezoneDestination(null)).toBeNull();
  });

  it("builds safe planner and sign-up links", () => {
    const plan = plannerHref("Paris, France");
    expect(plan).toBe("/?destination=Paris%2C%20France");
    const signUp = signUpHref("Paris, France");
    expect(signUp.startsWith("/sign-up?redirect_url=")).toBe(true);
    const returnPath = signUp.slice("/sign-up?redirect_url=".length);
    expect(decodeURIComponent(returnPath)).toBe(plan);
  });
});

describe("ad click validation", () => {
  const valid = {
    destination: "Paris, France",
    placement: "landing",
    intent: "plan",
    variant: "poster",
    target: "plan",
  } as const;

  it("accepts a bounded click", () => {
    expect(parseAdClick(valid)).toEqual(valid);
  });

  it("rejects unknown fields and out-of-range values", () => {
    expect(parseAdClick(null)).toBeNull();
    expect(parseAdClick({ ...valid, placement: "Landing Page" })).toBeNull();
    expect(parseAdClick({ ...valid, intent: "subscribe" })).toBeNull();
    expect(parseAdClick({ ...valid, variant: "tower" })).toBeNull();
    expect(parseAdClick({ ...valid, target: "checkout" })).toBeNull();
    expect(parseAdClick({ ...valid, destination: "a".repeat(141) })).toBeNull();
  });
});
