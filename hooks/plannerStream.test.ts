import { describe, expect, it } from "vitest";
import { parsePlannerFailure } from "./plannerStream";

describe("parsePlannerFailure", () => {
  it("keeps an explicit plan-limit code and its calm server copy", () => {
    expect(
      parsePlannerFailure(
        {
          error: "The Care Circle plan includes two live trips a month.",
          code: "trip_limit",
        },
        403,
      ),
    ).toEqual({
      message: "The Care Circle plan includes two live trips a month.",
      code: "trip_limit",
    });
  });

  it("keeps an explicit long-trip limit code", () => {
    expect(
      parsePlannerFailure(
        { error: "The Free plan includes trips up to 7 days.", code: "plan_limit" },
        403,
      ).code,
    ).toBe("plan_limit");
  });

  it("drops unknown codes and replaces raw or missing text", () => {
    expect(
      parsePlannerFailure({ error: "Nope.", code: "saved_trip_limit" }, 403),
    ).toEqual({ message: "Nope.", code: null });
    expect(parsePlannerFailure({ code: "trip_limit" }, 403)).toEqual({
      message: "The planning service could not start. Try again.",
      code: "trip_limit",
    });
    expect(parsePlannerFailure(null, 500)).toEqual({
      message: "The planning service is unavailable. Try again in a moment.",
      code: null,
    });
  });
});
