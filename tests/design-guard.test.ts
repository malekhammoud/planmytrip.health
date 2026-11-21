import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Design guard. Scans the interface source for styles and strings that break
 * the Paper and Ink system. A line containing "design-guard-ignore" is exempt.
 */

interface Rule {
  name: string;
  pattern: RegExp;
  /** Apply only to matching files. */
  appliesTo?: (file: string) => boolean;
  /** Never apply to matching files. */
  skipIn?: (file: string) => boolean;
}

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

const COLOR_UTILITY =
  "bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|fill|stroke|from|via|to|divide(?:-[xy])?|outline|decoration";

const isUi = (file: string): boolean => file.startsWith("components/ui/");
const isTs = (file: string): boolean => /\.(ts|tsx)$/.test(file);

const RULES: Rule[] = [
  {
    name: "default Tailwind palette color",
    pattern: new RegExp(
      `\\b(?:${COLOR_UTILITY})-(?:${PALETTE})-(?:50|[1-9]00|950)\\b`,
    ),
  },
  {
    name: "raw white or black utility",
    pattern:
      /\b(?:bg|text|border|ring|fill|stroke|divide|outline|decoration)-(?:white|black)\b/,
  },
  {
    name: "raw color literal",
    pattern: /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/,
    appliesTo: isTs,
  },
  {
    name: "arbitrary color utility",
    pattern: new RegExp(
      `\\b(?:${COLOR_UTILITY})-\\[(?:[a-zA-Z]+|#[0-9a-fA-F]{3,8}|rgba?\\(|hsla?\\()`,
    ),
  },
  {
    name: "default Tailwind text size",
    pattern: /\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b/,
  },
  {
    name: "arbitrary text size",
    pattern: /\btext-\[[^\]]+\]/,
  },
  {
    name: "non-approved font weight",
    pattern: /\bfont-(?:thin|extralight|light|bold|extrabold|black)\b/,
  },
  {
    // Rejects bare shadow, shadow-sm, shadow-[...]; permits shadow-none.
    name: "shadow",
    pattern: /\bshadow\b(?!-none\b)/,
  },
  {
    name: "gradient or blur effect",
    pattern:
      /\bbg-gradient-|\bbg-linear-|\bbg-radial\b|\bbg-conic-|\btext-transparent\b|\bbg-clip-text\b|\bbackdrop-blur\b|\bblur\b/,
  },
  {
    // Only the 4px and 6px system radii pass; full is checked separately.
    name: "unsupported radius",
    pattern: /\brounded\b(?!-(?:none|frame|control|full)\b)/,
  },
  {
    name: "pill radius outside components/ui",
    pattern: /\brounded-full\b/,
    skipIn: isUi,
  },
  {
    name: "raw form control outside components/ui",
    pattern: /<(?:button|input|select|textarea)\b/,
    skipIn: isUi,
  },
  {
    name: "emoji",
    pattern: /\p{Extended_Pictographic}/u,
  },
  {
    name: "flag emoji",
    pattern: /\p{Regional_Indicator}/u,
  },
  {
    name: "image support",
    pattern: /<img\b|<Image\b|\bnext\/image\b|\bbackground-image\b|\bbg-\[url\(/,
  },
  {
    // Motion is a named vocabulary in globals.css; Tailwind's canned loops are banned.
    name: "banned Tailwind animation",
    pattern: /\banimate-(?:spin|ping|pulse|bounce)\b/,
  },
  {
    name: "transition-all",
    pattern: /\btransition-all\b/,
  },
  {
    name: "banned marketing copy",
    pattern:
      /\b(?:unlock|supercharge|seamless|revolutionize)\b|welcome to|lorem ipsum/i,
  },
];

const ROOTS: ReadonlyArray<{
  dir: string;
  extensions: readonly string[];
  exclude: readonly string[];
}> = [
  { dir: "app", extensions: [".ts", ".tsx", ".css"], exclude: ["app/globals.css"] },
  { dir: "components", extensions: [".tsx"], exclude: [] },
];

function collectFiles(dir: string, extensions: readonly string[]): string[] {
  const absolute = path.join(process.cwd(), dir);
  if (!existsSync(absolute)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      found.push(...collectFiles(relative, extensions));
    } else if (extensions.some((extension) => entry.name.endsWith(extension))) {
      found.push(relative);
    }
  }
  return found;
}

function sourceFiles(): string[] {
  return ROOTS.flatMap((root) =>
    collectFiles(root.dir, root.extensions).filter(
      (file) => !root.exclude.includes(file),
    ),
  ).sort();
}

/** Returns the names of every rule the line breaks. */
function ruleViolations(line: string, file: string): string[] {
  if (line.includes("design-guard-ignore")) return [];
  return RULES.filter(
    (rule) =>
      (!rule.appliesTo || rule.appliesTo(file)) &&
      (!rule.skipIn || !rule.skipIn(file)) &&
      rule.pattern.test(line),
  ).map((rule) => rule.name);
}

function violations(): string[] {
  const output: string[] = [];
  for (const file of sourceFiles()) {
    const lines = readFileSync(path.join(process.cwd(), file), "utf8").split("\n");
    lines.forEach((line, index) => {
      for (const name of ruleViolations(line, file)) {
        output.push(`${file}:${index + 1}: ${name} -> ${line.trim()}`);
      }
    });
  }
  return output;
}

const BANNED_FIXTURES: ReadonlyArray<{
  source: string;
  file?: string;
  rule: string;
}> = [
  { source: 'className="border-t-red-500"', rule: "default Tailwind palette color" },
  { source: 'className="ring-offset-blue-500"', rule: "default Tailwind palette color" },
  { source: 'className="bg-white text-black"', rule: "raw white or black utility" },
  { source: 'const tint = "#1F3AD6";', rule: "raw color literal" },
  { source: 'className="bg-[red]"', rule: "arbitrary color utility" },
  { source: 'className="text-[15px]"', rule: "arbitrary text size" },
  { source: 'className="text-xl"', rule: "default Tailwind text size" },
  { source: 'className="font-bold"', rule: "non-approved font weight" },
  { source: 'className="shadow-sm"', rule: "shadow" },
  {
    source: 'className="shadow-[0_0_10px_var(--ink)]"',
    rule: "shadow",
  },
  { source: 'className="bg-linear-to-r"', rule: "gradient or blur effect" },
  { source: 'className="blur-sm"', rule: "gradient or blur effect" },
  { source: 'className="rounded-lg"', rule: "unsupported radius" },
  { source: 'className="rounded-full"', rule: "pill radius outside components/ui" },
  { source: 'className="animate-ping"', rule: "banned Tailwind animation" },
  { source: 'className="animate-pulse"', rule: "banned Tailwind animation" },
  { source: 'className="transition-all"', rule: "transition-all" },
  { source: '<button type="button">', rule: "raw form control outside components/ui" },
  { source: 'const label = "Book now \u{1f389}";', rule: "emoji" },
  { source: 'const flag = "\u{1f1e8}\u{1f1e6}";', rule: "flag emoji" },
  { source: '<img src="/x.png" alt="" />', rule: "image support" },
  { source: 'const copy = "Unlock your trip";', rule: "banned marketing copy" },
];

const ALLOWED_FIXTURES: ReadonlyArray<{ source: string; file: string }> = [
  {
    source:
      'className="bg-paper text-ink border-hairline shadow-none rounded-frame rounded-control"',
    file: "app/fixture.tsx",
  },
  { source: 'className="rounded-full"', file: "components/ui/fixture.tsx" },
  {
    source: '<input aria-label="Destination" />',
    file: "components/ui/fixture.tsx",
  },
  {
    source: 'className="bg-red-500" // design-guard-ignore',
    file: "app/fixture.tsx",
  },
];

describe("design guard", () => {
  it("scans the interface source", () => {
    expect(sourceFiles()).toContain("app/page.tsx");
  });

  it("uses only Paper and Ink tokens and type classes", () => {
    const found = violations();
    expect(
      found,
      `Design guard violations:\n${found.join("\n")}`,
    ).toEqual([]);
  });

  for (const fixture of BANNED_FIXTURES) {
    it(`rejects ${fixture.source}`, () => {
      expect(ruleViolations(fixture.source, fixture.file ?? "app/fixture.tsx")).toContain(
        fixture.rule,
      );
    });
  }

  for (const fixture of ALLOWED_FIXTURES) {
    it(`permits ${fixture.source}`, () => {
      expect(ruleViolations(fixture.source, fixture.file)).toEqual([]);
    });
  }
});

describe("motion guard", () => {
  it("defines the named motion classes and switches them off for reduced motion", () => {
    const css = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
    for (const name of [
      "anim-fade",
      "anim-rise",
      "anim-arrive",
      "anim-tick",
      "anim-pulse-dot",
      "anim-collapse",
    ]) {
      expect(css, `missing .${name}`).toContain(`.${name}`);
    }
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    const reduced = css.match(
      /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.anim-arrive[\s\S]*?\n\}/,
    );
    expect(reduced, "missing reduced-motion block for the motion vocabulary").not.toBeNull();
  });
});
