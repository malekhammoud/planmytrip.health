import { describe, expect, it } from "vitest";
import {
  collectAssistantText,
  extractJsonObject,
  normalizeSpecialistResult,
} from "./agentParse";

describe("extractJsonObject", () => {
  it("reads a plain object", () => {
    expect(extractJsonObject('{"ok":true}')).toEqual({ ok: true });
  });

  it("reads a fenced object with commentary", () => {
    expect(extractJsonObject('Here is the result:\n```json\n{"ok":true}\n```')).toEqual({
      ok: true,
    });
  });

  it("reads an object surrounded by prose with stray braces", () => {
    expect(
      extractJsonObject(
        'I checked the {old town} first. Here is the result: {"stays":[]} Done.',
      ),
    ).toEqual({ stays: [] });
  });

  it("repairs a trailing comma", () => {
    expect(extractJsonObject('{"stays":[],}')).toEqual({ stays: [] });
  });

  it("returns null for invalid text", () => {
    expect(extractJsonObject("not json")).toBeNull();
    expect(extractJsonObject(null)).toBeNull();
  });
});

describe("collectAssistantText", () => {
  it("joins assistant text parts and ignores reasoning and user text", () => {
    const messages = [
      { type: "user", text: "ignore me" },
      {
        type: "assistant",
        content: [
          { type: "reasoning", text: "hidden" },
          { type: "text", text: "first" },
          { type: "tool", name: "websearch" },
          { type: "text", text: "second" },
        ],
      },
    ];
    expect(collectAssistantText(messages)).toBe("first\nsecond");
  });

  it("returns an empty string for malformed input", () => {
    expect(collectAssistantText(null)).toBe("");
    expect(collectAssistantText([{ type: "assistant", content: "wrong" }])).toBe("");
  });
});

describe("normalizeSpecialistResult", () => {
  it("normalises stays and keeps valid coordinates", () => {
    const result = normalizeSpecialistResult("stay", {
      stays: [
        {
          name: "Hotel A",
          area: "Old town",
          lat: 38.71,
          lng: -9.14,
          priceBand: "Balanced",
          why: "Short walk to the first day.",
          nights: 3,
          booking: "Book direct.",
          conditionNotes: "Ask for a quiet room.",
          sourceUrl: "https://example.com/hotel-a",
        },
      ],
    });
    expect(result.picks).toHaveLength(1);
    expect(result.picks[0]).toMatchObject({
      category: "stay",
      name: "Hotel A",
      lat: 38.71,
      lng: -9.14,
      nights: 3,
    });
    expect(result.sources).toEqual([
      { title: "Hotel A", url: "https://example.com/hotel-a" },
    ]);
    expect(result.summary).toBe("1 verified place");
  });

  it("drops picks without a name and nulls out-of-range coordinates", () => {
    const result = normalizeSpecialistResult("table", {
      restaurants: [
        { area: "No name", lat: 1, lng: 1 },
        {
          name: "Cafe B",
          lat: 200,
          lng: -9.14,
          sourceUrl: "javascript:alert(1)",
        },
      ],
    });
    expect(result.picks).toHaveLength(1);
    expect(result.picks[0]).toMatchObject({ name: "Cafe B", lat: null, lng: null });
    expect(result.picks[0]?.sourceUrl).toBeNull();
  });

  it("normalises care resources and notes the emergency number", () => {
    const result = normalizeSpecialistResult("care", {
      hospitals: [
        {
          name: "Central Hospital",
          address: "1 Main Street",
          lat: 38.7,
          lng: -9.1,
          phone: "+351 000",
          sourceUrl: "https://example.com/hospital",
        },
      ],
      pharmacies: [],
      emergencyNumber: "112",
      localRisks: ["Summer heat"],
      notes: ["Confirm the route"],
      sources: [{ title: "Care page", url: "https://example.com/care" }],
    });
    expect(result.picks[0]).toMatchObject({
      category: "care",
      careType: "hospital",
      address: "1 Main Street",
      phone: "+351 000",
    });
    expect(result.notes).toContain("Emergency number: 112");
    expect(result.notes).toContain("Summer heat");
    expect(result.sources).toHaveLength(2);
  });

  it("unwraps a single-element result array", () => {
    const result = normalizeSpecialistResult("stay", [
      { stays: [{ name: "Hotel A", area: "Old town" }] },
    ]);
    expect(result.picks.map((pick) => pick.name)).toEqual(["Hotel A"]);
  });

  it("turns transit fields into bounded notes", () => {
    const result = normalizeSpecialistResult("transit", {
      airportTransfer: "Take the train.",
      localTransit: "Use a transit card.",
      walkability: "Uneven paving.",
      taxi: "Use the official app.",
      accessibility: "Confirm step-free access.",
      notes: ["Keep transfers cool."],
      sources: [{ title: "Transit", url: "https://example.com/transit" }],
    });
    expect(result.picks).toHaveLength(0);
    expect(result.notes).toHaveLength(6);
    expect(result.summary).toBe("6 transit notes");
    expect(result.sources).toHaveLength(1);
  });
});
