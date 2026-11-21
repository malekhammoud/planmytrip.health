# AGENTS.md

The single source of truth for anyone, or any agent, working on PlanMyTrip.health.
Read this file before touching code. Read `BUILD_LOG.md` for the current step and
the reasons behind decisions. Update this file in the same commit as any change to
commands, environment variables, layout, data flow, conventions, or limitations.

## 1. What this is

PlanMyTrip.health is a health-first travel planner for people with medical conditions
or health concerns. Users are patients and caregivers, often anxious, on a phone or
a laptop. The product does two jobs:

1. Generate a biologically paced itinerary from condition-specific physiological limits.
2. Verify real-world travel risk with three parallel browser agents whose live sessions
   the user can watch.

The sister product is [IsMyTripSafe.com](https://ismytripsafe.com). That product is
photo-led: hero photography, a postcard destination grid, flag emoji, 0 to 100 score
cards, a green/yellow/red stoplight metaphor, and a search-first landing. PlanMyTrip.health
deliberately shares none of that. There is no photography, illustration, emoji, flag,
stoplight color or metaphor, score ring, verdict card, destination grid, centered hero,
or search-first landing here.

The concept is a well-typeset clinical chart crossed with a Swiss timetable:
typographic, document-like, ruled with hairlines, generous whitespace. A printed care
plan, not a SaaS dashboard. The signature element is the pacing strip: a per-day
timeline of exertion bars and recovery blocks. See section 7 for the design system.

## 2. Status

Steps are built and committed in order with the exact messages below. A checked step
means the code, tests, and this file agree at that commit.

| Step | State | Commit message |
| --- | --- | --- |
| 1. Project baseline | [x] | `chore: initialize PlanMyTrip.health baseline` |
| 2. Design system primitives | [x] | `feat(ui): add design system primitives` |
| 3. Biological pacing engine | [ ] Not built yet | `feat(engine): add biological pacing and itinerary engine` |
| 4. TinyFish 3-worker SSE route | [ ] Not built yet | `feat(api): add parallel 3-worker TinyFish SSE swarm` |
| 5. Header, constraint rail, page layout | [ ] Not built yet | `feat(ui): add header and biological constraint sidebar` |
| 6. Live agent swarm monitor | [ ] Not built yet | `feat(ui): add live TinyFish agent iframes and findings cards` |
| 7. KPI strip and paced itinerary | [ ] Not built yet | `feat(ui): add safety KPIs, paced itinerary cards, and care card export` |
| 8. Documentation and identity audit | [ ] Not built yet | `docs(agents): finalize AGENTS.md for future coding agents` |

Current state: the placeholder home page, the Paper and Ink tokens and type classes, the
shared condition vocabulary, the design guard, contrast, and smoke tests, and the
`components/ui` primitives. The engine, swarm route, and full interface are not built yet.

## 3. Commands

Run everything from the repository root. All commands are non-interactive.

```bash
# Install. If NODE_ENV=production is set in your shell, npm omits dev dependencies,
# so use --include=dev (TypeScript, ESLint, and Vitest are dev dependencies).
npm install --include=dev

# Develop
npm run dev

# Individual checks
npm run typecheck     # tsc --noEmit
npm test              # vitest run, never watch
npm run lint          # eslint
npm run build         # next build

# Full gate, copy-pasteable
npm run typecheck && npm test && npm run lint && npm run build
```

Never run `npm run dev` in the foreground during automation. Start it in the
background with output in a log file, probe it with `curl --max-time`, then stop it.
Use `vitest run`, never watch mode. Do not push.

## 4. Environment

| Variable | Where used | Behavior when missing |
| --- | --- | --- |
| `TINYFISH_API_KEY` | Server only, the Step 4 swarm route (not built yet) | Each worker reports `worker_error` with code `missing_api_key`; the stream still returns 200. Never log, echo, or commit it. |
| `SWARM_MOCK` | Server only, Step 4 route (not built yet) | When `1` and `NODE_ENV !== "production"`, the route emits mock events carrying `mock: true`. Ignored in production. |
| `NODE_ENV` | Next.js, swarm mock guard | Next sets it. Production disables mock mode. |

`.env.example` is committed and contains empty placeholders. `.env*` is ignored except
`.env.example`. Never read, print, or commit a real `.env*` file. For local use:

```bash
cp .env.example .env.local
# set TINYFISH_API_KEY in .env.local
npm run dev
```

## 5. Architecture

Built now:

```text
app/
  globals.css        Paper and Ink tokens, theme mapping, type classes, base styles
  layout.tsx         Fontsource imports, metadata, html lang, body tokens
  page.tsx           Minimal placeholder home page; replaced in Step 5
lib/
  types.ts           CONDITIONS, Condition, CONDITION_LABELS, isCondition
components/
  ui/                Paper and Ink primitives, all named exports from
                     components/ui/index.ts: Button (sm, md, and Deploy-only lg),
                     Field, TextInput, Select, Slider, Checkbox, StatusGlyph,
                     SectionHeader, Metric, Callout, DataRow, Skeleton. Pure helpers:
                     sliderFillPercent (sliderFill.ts) and metricBarWidths
                     (metricBars.ts), unit-tested in components/ui/*.test.ts.
                     Slider, Skeleton, and StatusGlyph use CSS modules with token
                     variables only, for native pseudo-elements and pulse.
tests/
  design-guard.test.ts   Source scan for banned styles, controls, and copy
  contrast.test.ts       WCAG AA checks for the token pairs
  smoke.test.ts          Condition vocabulary checks
vitest.config.mts    Node test environment and the @/ alias
```

Not built yet: `lib/healthTripEngine.ts` (Step 3),
`lib/tinyfish*.ts`, `lib/swarmTypes.ts`, `lib/swarmGoals.ts`, and
`app/api/travel-swarm/route.ts` (Step 4), the rail and page composition (Step 5), the
swarm monitor (Step 6), and the KPI strip and itinerary board (Step 7).

Planned data flow, to be confirmed as steps land:

```text
page.tsx state (destination, days, condition, medication, coverage)
  -> healthTripEngine (pure, useMemo) -> KPI strip + pacing itinerary
  -> Deploy -> POST /api/travel-swarm -> TinyFish SSE per worker
  -> useSwarm reducer -> AgentSwarmMonitor (status, live iframe, findings)
```

The itinerary must render from the engine alone, independent of agent results.

## 6. Key decisions

- **Next.js 16.4.6, React 19.3.0, Tailwind CSS 4.3.3.** Tailwind v4 is configured in
  `app/globals.css` with `@theme inline`; there is no `tailwind.config` file. The
  generated Turbopack CSS rule stays in `next.config.ts`.
- **No `next/font/google`.** All three families come from local Fontsource packages,
  imported in `app/layout.tsx`, so builds never need network access.
- **Vitest 4.1.12, not 5.x.** The scaffold pins `@types/node@^20`; Vitest 5 requires
  `@types/node >=22`. Dropping to Vitest 4 avoids `--legacy-peer-deps` and unnecessary
  type-package churn. The test script is `vitest run`.
- **The scaffold was generated inside the repo** because the directory already held
  `.git` and a user-owned `README.md`. The README was preserved untouched.
- **`cacheComponents` and `partialPrefetching` were removed** from the generated
  `next.config.ts` to keep default App Router caching behavior while the product is
  built. The Turbopack Tailwind rule was kept.
- **The Sun Life pre-existing-condition stability window was not supplied.** It must
  become a clearly named placeholder constant in the Step 4 insurance rules, marked
  `// VERIFY:`, and logged. Do not present it as policy.
- **No TinyFish key is present locally.** Verification uses tests and `SWARM_MOCK=1`;
  never call the live API from automated checks.
- **Primitive-only UI.** Later steps compose `components/ui` and never restyle a raw
  control. The guard permits raw form controls only inside `components/ui`. Button `lg`
  (48px) exists solely for the Step 5 Deploy action, whose spec requires 48px. Slider,
  Skeleton, and StatusGlyph use small CSS modules for native pseudo-elements and
  keyframes; modules use only `var(--token)` values and no raw colors, and the design
  guard does not scan them, so they need manual review. The Metric tooltip uses inline
  utilities and state because it must be dismissible and hoverable.

## 7. Conventions

### Commits

One step per commit, exact message from section 2. Only the orchestrator commits.
Never `git push`, never force, never change git config. Check `git status` before
staging: no `.env*` except `.env.example`, no `node_modules`, no build output.
Never use `--no-verify`.

### TypeScript and code

- Strict TypeScript. No `any`. No unexplained non-null assertions.
- Named exports in `lib/`. Files under about 250 lines. Small components.
- Every `lib/` module opens with a header comment: purpose, inputs and outputs,
  invariants. TSDoc on every exported function and type. Comment why, not what.
- Every `// VERIFY:` states what to check and where. Add it to section 9.
- Composition only: later UI composes `components/ui` primitives; do not restyle raw
  controls.

### Paper and Ink design system

Tokens are defined once in `app/globals.css` as CSS variables and exposed to Tailwind
through `@theme inline`. Use only these names: `paper`, `surface`, `sunken`, `ink`,
`ink-hover`, `muted`, `hairline`, `hairline-strong`, `accent`, `accent-hover`,
`accent-soft`, `on-accent`, `caution`, `caution-bar`, `risk`. Use no raw hex values in
components. Blue means recovery and action; accent is never body text.

Type classes are the only text sizes allowed. Never use Tailwind `text-sm`, `text-xl`,
and so on.

| Class | Role |
| --- | --- |
| `.t-display` | Instrument Serif 400, 56/60 desktop, 36/40 mobile. Page headline only. |
| `.t-title` | Instrument Serif 400, 32/36 desktop, 26/30 mobile. Section titles. |
| `.t-metric` | Instrument Serif 400, 72/72 desktop, 56/56 mobile, tabular numerals. |
| `.t-heading` | Hanken Grotesk 600, 17/24. |
| `.t-body` | Hanken Grotesk 400, 15/24, max measure 65ch. |
| `.t-small` | Hanken Grotesk 400, 13/20. |
| `.t-button` | Hanken Grotesk 500, 14/20. Button labels only. |
| `.t-label` | IBM Plex Mono 500, 11/16, uppercase, 0.08em tracking. |
| `.t-data` | IBM Plex Mono 400, 13/20, tabular numerals. |
| `.t-data-sm` | IBM Plex Mono 400, 11/16, tabular numerals. Ticks, axes, and metric captions. |

Layout: `.page-container` is max 1200px with 24px gutters (40px from 768px). `.measure`
caps a line at 65ch. Spacing is multiples of 4px. Section gaps are 96px desktop, 64px
mobile. Radius 4px for frames, code, and callouts; 6px for buttons. Hairlines and
whitespace only, never shadows.
Focus is a 2px accent outline with 2px offset. Motion: day rows rise 8px over 240ms
with a 40ms stagger; color transitions 150ms; everything off under reduced motion.

Banned: gradients, blur, glow, shadows, emoji, flags, stock imagery, illustrations,
purple, centered heroes, feature-card grids, pill badges, marketing words (unlock,
supercharge, seamless, revolutionize, welcome to), lorem ipsum, default Tailwind
palette colors, default Tailwind text sizes, raw hex in components.

### Accessibility and copy

WCAG AA contrast. Every control is keyboard reachable and has a bound label. Tap
targets at least 44px. No text under 13px except 11px mono labels. Every async surface
has designed empty, loading, error, and success states. Copy is calm, specific,
sentence case, without exclamation marks or emoji; sentences stay under 20 words.
Numbers carry units. `healthSafetyScore` and `riskReductionPct` are always labelled
"Modeled estimate" with a tooltip listing inputs.

### Guard tests

`tests/design-guard.test.ts` scans `app/**/*.{ts,tsx,css}` (except `app/globals.css`)
and `components/**/*.tsx`. It fails with `file:line` on canonical and axis/side variants
of the default palette, raw white/black, hex or rgb/hsl and arbitrary color utilities,
default and arbitrary text sizes, unapproved font weights, every shadow except
`shadow-none`, gradients and blur, radii outside the `none`/`frame`/`control` allowlist,
pill radii outside `components/ui`, raw form controls outside `components/ui`, emoji,
flag emoji, image usage, and banned marketing copy. A `design-guard-ignore` comment on a
line exempts that line. Nineteen banned fixtures and four allowed fixtures prove the
rules. `tests/contrast.test.ts` checks 13 token pairs at 4.5:1 or better.

## 8. Medical safety rules

- The product is a planning aid, not medical advice. A quiet persistent footer notice
  reads: "Planning aid only. Not medical advice. Confirm with your clinician and insurer
  before you travel."
- All physiological thresholds live in one typed `CONDITION_PROFILES` constant (Step 3),
  each with a rationale string and a `// VERIFY:` flag. No magic numbers elsewhere.
- `healthSafetyScore` and `riskReductionPct` are deterministic modeled estimates from a
  documented formula. Label them "Modeled estimate" with an input tooltip. Never call
  them measured or clinically validated.
- Insurance rules (60-day cap, Allianz Global Assistance 24/7 pre-authorization, the
  pre-existing stability window) live in one `SUN_LIFE_RULES` constant marked
  `// VERIFY against current group policy` (Step 4). The alert tells the user to
  "Verify with your plan administrator".
- Never suggest doses or medication changes. Medication information is limited to
  generic and brand names, customs, and carry rules.
- Agent findings show the source URL and retrieved time. Missing fields show
  "Not found", never a guess. Malformed JSON shows the raw text plus a parse error.

## 9. VERIFY register

Regenerate with `grep -rn "VERIFY:" app lib components`.

At this commit: none. No physiological thresholds or insurance rules exist yet.

## 10. External integrations

TinyFish Web Agent API (Step 4; not built yet):

- `POST https://agent.tinyfish.ai/v1/automation/run-sse`
- Header `X-API-Key: process.env.TINYFISH_API_KEY`
- JSON body `{ "url": string, "goal": string }`, plus the optional `output_schema`
  object (top-level object; `nullable: true`; no `oneOf`, `const`, or
  `additionalProperties`).
- The stream is `data: <json>` frames. Documented events: `STARTED`
  (`run_id`, `timestamp`), `STREAMING_URL` (`streaming_url`), `PROGRESS` (`purpose`),
  `HEARTBEAT` (`timestamp` only), `COMPLETE` (`status` of `COMPLETED`, `FAILED`, or
  `CANCELLED`; optional `result`, `error`, `help_url`, `help_message`, `profile_hint`),
  and the optional `TF_API_RESULT`. Ignore unknown event types and fields.
- A streaming URL is emitted for iframe embedding and may expire after the run.
- Docs: <https://docs.tinyfish.ai/tinyagent/api/agent/endpoints.md>,
  <https://docs.tinyfish.ai/api-reference/automation/run-browser-automation-with-sse-streaming.md>,
  <https://docs.tinyfish.ai/live-preview.md>,
  <https://docs.tinyfish.ai/tinyagent/api/agent/structured-output.md>.

The route will expose our own SSE events: `worker_status`, `streaming_url`,
`worker_progress`, `worker_complete`, `worker_error`, `swarm_done`. Cost warning:
each run drives three real browser agents; do not call the live API in tests or during
routine development. Use `SWARM_MOCK=1` locally.

## 11. Testing

`npm test` runs Vitest once in a Node environment. The current suite has 54 tests:

- `tests/design-guard.test.ts`: token, type, control, emoji, and copy guard.
- `tests/contrast.test.ts`: WCAG AA contrast for the token pairs.
- `tests/smoke.test.ts`: the five conditions and the label map.
- `components/ui/sliderFill.test.ts` and `metricBars.test.ts`: primitive geometry.

Add pure-function tests next to the module or under `tests/`, named `*.test.ts`. The
Vitest include pattern is `**/*.test.ts`. No component-test libraries. Route and SSE
tests use mocked fetch and fixtures, never the network. Keep the design guard green
rather than exempting lines.

## 12. Known limitations and open questions

- Only the baseline and `components/ui` primitives exist: no pacing engine, swarm route,
  agent monitor, itinerary, care card, or full page.
- TinyFish event names and payloads are documented, but no live run has been made. The
  route must still tolerate unknown events, stringified `result` values, and partial
  payloads.
- The Sun Life pre-existing-condition stability window is unknown. It needs a named
  placeholder and a `// VERIFY:` flag.
- No live TinyFish key has been exercised. Missing-key and mock paths are the only
  planned verification.
- The current home page is a placeholder and will be replaced in Step 5.
- The user-owned `README.md` is intentionally untouched; this file is the working guide.
- Light theme only. Tokens are structured so a dark theme could be added later.
- Destination strings are labels only. The engine does not invent venues or geography.

## 13. How to work here

1. Read this file, then `BUILD_LOG.md`.
2. Run `git log --oneline`, `git status`, and `git diff`. Never discard uncommitted work
   from an interrupted step; inspect it and finish it.
3. Find the first unchecked step in section 2 and continue there.
4. Work in dependency order. No scope creep: no extra pages, auth, database, analytics,
   or libraries.
5. Run the full gate. Update this file in the same commit as any change it describes.
6. Commit with the exact step message. Append a short step entry to `BUILD_LOG.md` and
   set its "Next action" line.
7. Stuck: three attempts on the same error, then change approach once, then log the
   exact error and a minimal safe workaround under Blockers. Never loop.
