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
| 3. Biological pacing engine | [x] | `feat(engine): add biological pacing and itinerary engine` |
| 4. TinyFish 3-worker SSE route | [x] | `feat(api): add parallel 3-worker TinyFish SSE swarm` |
| 5. Header, constraint rail, page layout | [ ] Not built yet | `feat(ui): add header and biological constraint sidebar` |
| 6. Live agent swarm monitor | [ ] Not built yet | `feat(ui): add live TinyFish agent iframes and findings cards` |
| 7. KPI strip and paced itinerary | [ ] Not built yet | `feat(ui): add safety KPIs, paced itinerary cards, and care card export` |
| 8. Documentation and identity audit | [ ] Not built yet | `docs(agents): finalize AGENTS.md for future coding agents` |

Current state: the placeholder home page, the Paper and Ink tokens and type classes, the
shared condition vocabulary, the `components/ui` primitives, the pure pacing engine, and
the 3-worker TinyFish SSE route with mock mode. The rail, page composition, agent monitor,
and itinerary are not built yet.

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
| `TINYFISH_API_KEY` | Server only, `app/api/travel-swarm/route.ts` | Each worker reports `worker_error` with code `missing_api_key`; the stream still returns 200. Never log, echo, or commit it. |
| `SWARM_MOCK` | Server only, swarm route | When `1` and `NODE_ENV !== "production"`, the route emits mock events carrying `mock: true`. Ignored in production. |
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
  api/travel-swarm/route.ts  Body validation, guarded SSE stream, runSwarm call
lib/
  sse.ts                      Pure buffering SSE parser (createSseParser)
  tinyfish.ts                 TinyFish fetch client; re-exports the parser
  tinyfishEvents.ts           Upstream TinyFish event to SwarmEvent mapping
  swarmTypes.ts               Worker ids, body guard, findings, events, frame encoder
  swarmGoals.ts               Sources, goals, output schemas, normalisers
  swarmRunner.ts              Live/mock worker execution, timeouts, errors, swarm_done
  swarmMock.ts                Dev-only mock findings and lifecycle
  tinyfish.test.ts            Parser and client tests
  tinyfishEvents.test.ts      Mapper fixtures, provenance, URL schemes
  swarmGoals.test.ts          Schema, goal, placeholder, shared-rule tests
  types.ts                    CONDITIONS, Condition, CONDITION_LABELS, isCondition
  healthTripEngine.ts         Public entry: validation, buildHealthTripPlan, re-exports
  healthTripTypes.ts          Inputs, typed error, profiles, blocks, days, plan, alerts
  conditionProfiles.ts        CONDITION_PROFILES, DEFAULT_MEDICATION_BY_CONDITION,
                              MEDICATION_DISCLAIMER
  sunLifeRules.ts             SUN_LIFE_RULES, null stability placeholder,
                              checkSunLifeCoverage
  healthScore.ts              MODELED_LOAD_ASSUMPTIONS, modelDayLoad,
                              computeHealthScores
  itineraryBuilder.ts         PACING_POLICY, buildItinerary, blocks, checkpoints
  healthTripEngine.test.ts    Condition/day matrix, caps, recovery, determinism
  healthTripEngineRules.test.ts  Sun Life, validation, docs, module boundaries
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
  healthTripFixtures.ts  Shared engine test input and helpers
  design-guard.test.ts   Source scan for banned styles, controls, and copy
  contrast.test.ts       WCAG AA checks for the token pairs
  smoke.test.ts          Condition vocabulary checks
vitest.config.mts    Node test environment and the @/ alias
```

Not built yet: the rail and page composition (Step 5), the swarm monitor (Step 6), and
the KPI strip and itinerary board (Step 7).

Data flow:

```text
page.tsx state (destination, days, condition, medication, coverage)
  -> healthTripEngine (pure, useMemo) -> KPI strip + pacing itinerary
  -> Deploy -> POST /api/travel-swarm -> three TinyFish SSE runs
  -> worker events -> useSwarm reducer -> AgentSwarmMonitor
```

The itinerary renders from the engine alone, independent of agent results.

### Biological pacing engine

`buildHealthTripPlan(input)` is pure and deterministic: no I/O, `Date`, `Math.random`,
or locale output. Invalid input throws `HealthTripInputError` with a stable code and
field. A generated day that exceeds its modeled caps throws `ItineraryInvariantError`.
The public API is re-exported from `@/lib/healthTripEngine`.

Modeled score. The standard sightseeing baseline is 10,000 steps, 8 km, and average
exertion 2.2 per day with no recovery. Planned pressure combines:

- Exposure: `max(highest daily step share, highest daily walking share)` of the
  condition ceiling, normalized from half the ceiling to the full ceiling.
- Baseline exposure: `max(10,000 / stepCeiling, 8 / walkingKm)`, normalized
  `(baselineLoad - 1) / 2`.
- Exertion: `sum(durationMin * exertion) / sum(durationMin)`, normalized
  `(average - 1) / 2`.
- Recovery gap: `1 - totalRecoveryMinutes / max(1, recoveryMinutes * days)`.
- Trip length: `(days - 2) / 5`.

Weights are 45/20/20/15 (exposure/exertion/recovery/trip). Residual risk is
`floor + (100 - floor) * pressure`; `healthSafetyScore = 100 - residual risk`, rounded
and clamped 0-100. The baseline uses the same floor, no recovery, and 55/20/15/10.
`riskReductionPct = (score - baseline) / max(1, 100 - baseline) * 100`, rounded and
clamped 0-100. All scores are modeled estimates, never clinical validation. The
generated plan is deliberately conservative: its peak day sits below half the ceiling
and every day supplies full recovery, so the exposure and recovery terms are zero for
supported plans and the score is driven by exertion, trip length, and the profile floor.
The terms are tested with synthetic high-exposure and no-recovery days.

`MODELED_LOAD_ASSUMPTIONS.kmPerStep` is 0.0005 km, a conservative modeled stride. Every
profile ceiling and day cap fits inside its walking cap. Modeled steps count only
acclimation, cultural, and transit blocks; meals and recovery contribute zero. The
residual-risk floor is a modeled score ceiling, not a clinical claim; every profile
VERIFY line names its floor.

| Condition | Steps/day | Walking | Recovery | Floor | Rationale |
| --- | --- | --- | --- | --- | --- |
| `asthma_respiratory` | 7,000 | 4.0 km | 30 min, required | 22 | Breath-limited ceiling with a short afternoon recovery. |
| `chronic_fatigue_pots` | 4,000 | 2.5 km | 90 min, required | 25 | Low load with a long recovery for orthostatic symptoms. |
| `pregnancy_second_trimester` | 5,000 | 3.0 km | 45 min, required | 18 | Moderate load with rest, heat limits, and food safety. |
| `severe_food_allergy` | 6,000 | 3.5 km | 30 min, optional | 20 | Flexible recovery; emergency planning matters more. |
| `cardiac_hypertension` | 5,000 | 3.0 km | 45 min, required | 22 | Moderate load with midday recovery and altitude limits. |

`PACING_POLICY` in `lib/itineraryBuilder.ts` sets day cap factors: first 0.45, middle
0.8, final 0.4. "Lighter" means a smaller final cap; on a 2-day trip it is also below
Day 1. Adding a condition: add the identifier and label in `lib/types.ts`; add a
readonly profile with a VERIFY line including the floor; add a generic medication name
and a `CONDITION_CHECKPOINTS` entry; update this table and the VERIFY register; run both
engine test files. The exhaustive `Record<Condition, ...>` types make
`npx tsc --noEmit` fail until every entry exists.

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
- **The Sun Life pre-existing-condition stability window was not supplied.** It stays
  `null` in `lib/sunLifeRules.ts`, marked as a placeholder. The alerts say the window is
  not confirmed. Never replace it with an invented number; confirm with the plan
  administrator.
- **One Sun Life constant.** Both the engine alert and the Step 4 coverage goal import
  `SUN_LIFE_RULES` from `lib/sunLifeRules.ts`. Do not duplicate insurance values.
- **Engine split into modules.** The mandated profiles, score, itinerary, types, and
  rules live in separate files so no engine module approaches 250 lines; the public
  entry point re-exports them.
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
- All physiological thresholds live in one typed `CONDITION_PROFILES` constant in
  `lib/conditionProfiles.ts`, each with a rationale string, a modeled residual-risk
  floor, and a `// VERIFY:` flag. No magic numbers elsewhere.
- `healthSafetyScore` and `riskReductionPct` are deterministic modeled estimates from a
  documented formula. Label them "Modeled estimate" with an input tooltip. Never call
  them measured or clinically validated.
- Insurance rules (60-day cap, Allianz Global Assistance 24/7 pre-authorization, the
  pre-existing stability window) live in one `SUN_LIFE_RULES` constant in
  `lib/sunLifeRules.ts`, marked `// VERIFY against current group policy`. The stability
  window is `null` and unconfirmed. The alert tells the user to
  "Verify with your plan administrator".
- Never suggest doses or medication changes. Medication information is limited to
  generic and brand names, customs, and carry rules.
- Agent findings show the source URL and retrieved time. Missing fields show
  "Not found", never a guess. Malformed JSON shows the raw text plus a parse error.

## 9. VERIFY register

Regenerate with `grep -rn "VERIFY:" app lib components`.

At this commit: 7 entries.

| File | What to verify |
| --- | --- |
| `lib/conditionProfiles.ts` (asthma) | residual-risk floor 22; 7,000-step ceiling, 4.0 km walking, 30-minute recovery, altitude, heat, and allergens against current respiratory guidance. |
| `lib/conditionProfiles.ts` (POTS) | residual-risk floor 25; 4,000-step ceiling, 2.5 km walking, 90-minute recovery, altitude, heat, and allergens against current autonomic guidance. |
| `lib/conditionProfiles.ts` (pregnancy) | residual-risk floor 18; 5,000-step ceiling, 3.0 km walking, 45-minute recovery, altitude, heat, and food safety against current maternity guidance. |
| `lib/conditionProfiles.ts` (food allergy) | residual-risk floor 20; 6,000-step ceiling, 3.5 km walking, 30-minute optional recovery, heat, and allergens against current allergy guidance. |
| `lib/conditionProfiles.ts` (cardiac) | residual-risk floor 22; 5,000-step ceiling, 3.0 km walking, 45-minute recovery, altitude, heat, and sodium/allergens against current cardiology guidance. |
| `lib/sunLifeRules.ts` (stability placeholder) | The window is `null`; confirm the real value with the plan administrator. Never invent a number. |
| `lib/sunLifeRules.ts` (rules) | 60-day cap, Allianz Global Assistance 24/7 pre-authorization, and stability window against current group policy; record source and checked date. |

## 10. External integrations

TinyFish Web Agent API: `POST https://agent.tinyfish.ai/v1/automation/run-sse`, header
`X-API-Key`, JSON body `{url, goal, output_schema?}`. The key is read only in the route
and passed to the client; it is never logged or echoed. `output_schema` must be a
top-level object with `nullable: true` rather than type arrays; no `oneOf`, `const`, or
`additionalProperties`.

Upstream events are `data: <json>` frames: `STARTED` (run_id), `STREAMING_URL`,
`PROGRESS` (purpose), `HEARTBEAT`, `COMPLETE` (status/result/error), and optional
`TF_API_RESULT`. Unknown types are ignored; `COMPLETE.result` is authoritative. Only
absolute http(s) streaming URLs reach the UI.

Our route emits these SSE frames. Every payload has `worker`, an ISO `ts`, and optional
`mock`. `swarm_done` uses `worker: "swarm"` and is always last on a connected stream.

| Event | Fields | When |
| --- | --- | --- |
| `worker_status` | `status` (queued/running) | Before a run and when TinyFish reports STARTED. |
| `streaming_url` | `streamingUrl` | A safe STREAMING_URL arrives; it may expire. |
| `worker_progress` | `purpose` | TinyFish PROGRESS. |
| `worker_complete` | `findings`, `sourceUrl`, `retrievedAt`, `rawResult?`, `parseError?` | COMPLETED. Malformed JSON keeps raw text and parse error. |
| `worker_error` | `code`, `message` | Missing key, timeout, upstream error, unexpected rejection. |
| `swarm_done` | `completed`, `failed` | Once after all requested workers settle. |

Headers are `text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`,
and `X-Accel-Buffering: no`; a keep-alive comment is sent about every 15s. Client
disconnect aborts upstream requests. Error codes: `missing_api_key`, `timeout`,
`upstream_error`. Invalid bodies return 400 JSON.

Mock mode needs no key or network; every payload carries `mock: true` and preview URLs
use `mock.invalid`:

```bash
SWARM_MOCK=1 npm run dev
curl -N -X POST http://localhost:3000/api/travel-swarm \
  -H 'Content-Type: application/json' \
  -d '{"destination":"Lisbon, Portugal","condition":"asthma_respiratory","medication":"albuterol inhaler"}'
```

Each live run drives three real browser agents; never call it in tests or routine
development. Docs: <https://docs.tinyfish.ai/tinyagent/api/agent/endpoints.md>,
<https://docs.tinyfish.ai/api-reference/automation/run-browser-automation-with-sse-streaming.md>,
<https://docs.tinyfish.ai/live-preview.md>,
<https://docs.tinyfish.ai/tinyagent/api/agent/structured-output.md>.

## 11. Testing

`npm test` runs Vitest once in a Node environment. The current suite has 145 tests:

- `tests/design-guard.test.ts`: token, type, control, emoji, and copy guard.
- `tests/contrast.test.ts`: WCAG AA contrast for the token pairs.
- `tests/smoke.test.ts`: the five conditions and the label map.
- `components/ui/sliderFill.test.ts` and `metricBars.test.ts`: primitive geometry.
- `lib/healthTripEngine.test.ts` and `healthTripEngineRules.test.ts`: all conditions x
  2-7 days, caps and invariants, recovery, scores, determinism, Sun Life paths,
  validation, docs, and module re-exports. Shared input lives in
  `tests/healthTripFixtures.ts`.
- `lib/tinyfish.test.ts`, `tinyfishEvents.test.ts`, `swarmGoals.test.ts`, and
  `tests/swarm-route*.test.ts`: SSE parsing, event mapping, schemas, placeholder
  normalisation, missing key, isolation, retry subsets, mock mode, timeout, and
  swarm_done. All network is mocked.

Add pure-function tests next to the module or under `tests/`, named `*.test.ts`. The
Vitest include pattern is `**/*.test.ts`. No component-test libraries. Route and SSE
tests use mocked fetch and fixtures, never the network. Keep the design guard green
rather than exempting lines.

## 12. Known limitations and open questions

- Only the baseline, `components/ui` primitives, pacing engine, and swarm route exist:
  no rail, agent monitor, itinerary, care card, or full page.
- The Sun Life stability window is unknown and stored as `null`; no placeholder number
  is shown. Confirm it with the plan administrator.
- No live TinyFish run or real key has been exercised. Event handling is verified
  against docs-shaped fixtures and mocked fetch; streaming URLs may expire after a run.
- The route tolerates unknown events, stringified `result` values, and partial payloads.
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
