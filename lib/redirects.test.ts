import { describe, expect, it } from "vitest";
import { isSafeReturnPath, safeReturnPath, signInHref } from "./redirects";

describe("isSafeReturnPath", () => {
  it("accepts same-origin absolute paths", () => {
    for (const path of [
      "/",
      "/trips",
      "/trips/8c4f6f2e-6b4a-4b7e-9a1f-7f8e9d0c1b2a",
      "/account/security",
      "/trips?tab=plan#day-2",
      "/trips?next=//example.test",
      "/caf%C3%A9",
    ]) {
      expect(isSafeReturnPath(path), path).toBe(true);
    }
  });

  it("rejects paths that could leave the origin", () => {
    for (const path of [
      "",
      "trips",
      "//example.test",
      "///example.test",
      "/\\example.test",
      "https://example.test",
      "javascript:alert(1)",
      "mailto:help@example.test",
      " /trips",
      "/trips\nnext",
      "/trips\rnext",
      "/trips\u0000next",
    ]) {
      expect(isSafeReturnPath(path), path).toBe(false);
    }
  });

  it("rejects a path longer than the return-path bound", () => {
    expect(isSafeReturnPath(`/${"a".repeat(2048)}`)).toBe(false);
  });
});

describe("safeReturnPath", () => {
  it("returns a safe path and null for missing or unsafe values", () => {
    expect(safeReturnPath("/trips")).toBe("/trips");
    expect(safeReturnPath("//example.test")).toBeNull();
    expect(safeReturnPath("https://example.test")).toBeNull();
    expect(safeReturnPath(undefined)).toBeNull();
    expect(safeReturnPath(null)).toBeNull();
  });
});

describe("signInHref", () => {
  it("carries a validated return path to sign-in", () => {
    expect(signInHref("/trips")).toBe("/sign-in?redirect_url=%2Ftrips");
    expect(signInHref("/trips?tab=plan")).toBe(
      "/sign-in?redirect_url=%2Ftrips%3Ftab%3Dplan",
    );
  });

  it("drops an unsafe return path instead of creating an open redirect", () => {
    expect(signInHref("//example.test")).toBe("/sign-in");
    expect(signInHref("https://example.test")).toBe("/sign-in");
    expect(signInHref("/\\example.test")).toBe("/sign-in");
    expect(signInHref()).toBe("/sign-in");
  });
});
