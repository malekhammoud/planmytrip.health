import { describe, expect, it } from "vitest";
import { AGENT_SYSTEM_PROMPTS } from "./agentProfiles";
import { buildConciergePrompt, buildSpecialistPrompt } from "./agentPrompts";
import type { PlannerRequest } from "./agentTypes";

const request: PlannerRequest = {
  destination: "Lisbon, Portugal",
  origin: "",
  transport: "mixed",
  checkIn: "",
  travelers: 1,
  days: 4,
  condition: "pregnancy_second_trimester",
  medication: "prenatal vitamins",
  interests: "quiet food and short walks",
  budget: "premium",
};

describe("agent prompts", () => {
  it("carries the modeled limits and exact JSON instruction", () => {
    const prompt = buildSpecialistPrompt("stay", request);
    expect(prompt).toContain("Lisbon, Portugal");
    expect(prompt).toContain("second-trimester pregnancy");
    expect(prompt).toContain("5000 steps");
    expect(prompt).toContain("3 km walking");
    expect(prompt).toContain("prenatal vitamins");
    expect(prompt).toContain("Return exactly one JSON object");
    expect(prompt).toContain("Use at most 10 tool calls");
    expect(prompt).toContain("Return the JSON object by your 16th step");
    expect(prompt).toContain('"stays"');
    expect(prompt).not.toContain("mg");
  });

  it("tells the care scout not to diagnose", () => {
    const prompt = buildSpecialistPrompt("care", request);
    expect(prompt).toContain("Do not diagnose");
    expect(prompt).toContain("emergencyNumber");
  });

  it("carries the starting point and the travel method", () => {
    const prompt = buildSpecialistPrompt("transit", {
      ...request,
      origin: "Toronto, ON",
      transport: "walk",
    });
    expect(prompt).toContain("Starting from: Toronto, ON.");
    expect(prompt).toContain("Getting around: Walking.");
  });

  it("builds a synthesis prompt from research and caps", () => {
    const prompt = buildConciergePrompt(
      request,
      { stay: { picks: [{ name: "Hotel A" }] } },
      [{ day: 1, stepCap: 2250, walkingCapKm: 1.2, checkpoint: "Checkpoint" }],
    );
    expect(prompt).toContain("Verified research");
    expect(prompt).toContain("Hotel A");
    expect(prompt).toContain("2250");
    expect(prompt).toContain("Insert a rest day after any hike day");
    expect(prompt).toContain("Never place two demanding days back to back");
    expect(prompt).toContain('"selectedStays"');
  });

  it("keeps every system prompt free of dose guidance and markdown", () => {
    for (const prompt of Object.values(AGENT_SYSTEM_PROMPTS)) {
      expect(prompt).toContain("Never give medical advice");
      expect(prompt).toContain("Reserve your final steps");
      expect(prompt).not.toContain("```");
      expect(prompt).not.toMatch(/\b\d+\s?mg\b/i);
    }
  });
});
