import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * WCAG AA contrast guard for the Paper and Ink tokens.
 * Parses the single :root token block in app/globals.css.
 */

const PAIRS = [
  ["ink", "paper"],
  ["ink", "surface"],
  ["muted", "paper"],
  ["muted", "surface"],
  ["muted", "sunken"],
  ["accent", "paper"],
  ["accent", "surface"],
  ["accent", "accent-soft"],
  ["ink", "accent-soft"],
  ["on-accent", "accent"],
  ["paper", "ink"],
  ["caution", "paper"],
  ["risk", "paper"],
] as const;

function readTokens(): Map<string, string> {
  const css = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
  const tokens = new Map<string, string>();
  for (const match of css.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens.set(match[1], match[2].toLowerCase());
  }
  return tokens;
}

function channel(value: number): number {
  const ratio = value / 255;
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const red = (value >> 16) & 0xff;
  const green = (value >> 8) & 0xff;
  const blue = value & 0xff;
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function contrast(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("Paper and Ink contrast", () => {
  const tokens = readTokens();

  it("defines every token used by the pairs", () => {
    for (const [foreground, background] of PAIRS) {
      expect(tokens.has(foreground), `missing --${foreground}`).toBe(true);
      expect(tokens.has(background), `missing --${background}`).toBe(true);
    }
  });

  it.each(PAIRS)("%s on %s meets WCAG AA", (foreground, background) => {
    const ratio = contrast(tokens.get(foreground) ?? "", tokens.get(background) ?? "");
    expect(
      ratio,
      `${foreground} on ${background} is ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(4.5);
  });
});
