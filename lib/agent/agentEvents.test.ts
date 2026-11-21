import { describe, expect, it } from "vitest";
import { noteFromDelta, toolActivity } from "./agentEvents";

describe("toolActivity", () => {
  it("summarises a web search query", () => {
    expect(toolActivity("websearch", { query: "hotels in Lisbon" })).toEqual({
      kind: "search",
      text: "Searching: hotels in Lisbon",
    });
  });

  it("summarises a fetch by hostname", () => {
    expect(
      toolActivity("webfetch", { url: "https://www.timeout.com/lisbon/restaurants" }),
    ).toEqual({ kind: "read", text: "Reading: timeout.com" });
  });

  it("tolerates missing input and unknown tools", () => {
    expect(toolActivity("websearch", null).text).toBe("Searching the web");
    expect(toolActivity("mystery", {})).toEqual({
      kind: "tool",
      text: "Using mystery",
    });
  });
});

describe("noteFromDelta", () => {
  it("keeps a prose fragment", () => {
    expect(noteFromDelta("I am checking the official tourism page for quiet options.")).toBe(
      "I am checking the official tourism page for quiet options.",
    );
  });

  it("ignores short, JSON, and quoted fragments", () => {
    expect(noteFromDelta("short")).toBeNull();
    expect(noteFromDelta('{"stays": [{"name": "Hotel A"}]}')).toBeNull();
    expect(noteFromDelta('This is a quoted "fragment" that should be ignored.')).toBeNull();
  });
});
