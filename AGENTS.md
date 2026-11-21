# AGENTS.md

The single source of truth for PlanMyTrip.health. Read this first, then `BUILD_LOG.md` for
the current step and decisions. Update this file in the same commit as any change.

## 1. What this is

PlanMyTrip.health is a health-first travel planner for patients and caregivers, often
anxious, on a phone or laptop. It does two jobs: generate a biologically paced itinerary
from condition-specific limits, and verify travel risk with three parallel browser agents
whose live sessions the user can watch.

It is a planning aid, never medical advice: a well-typeset clinical chart crossed with a Swiss
timetable, typographic and ruled with hairlines. The pacing strip is the signature element.
See section 7.

Sister product [IsMyTripSafe.com](https://ismytripsafe.com) is photo-led (hero photography,
destination grid, flag emoji, score cards, stoplight metaphor, search-first landing). This
product shares none of it: no photography, illustration, emoji, flag, stoplight, score ring,
verdict card, grid, centered hero, or search-first landing.

## 2. Status

One step per commit, in order, with these exact messages. A checked step means code, tests,
and this file agree at that commit. Only the orchestrator commits.

| Step | State | Commit message |
| --- | --- | --- |
| 1. Project baseline | [x] | `chore: initialize PlanMyTrip.health baseline` |
| 2. Design system primitives | [x] | `feat(ui): add design system primitives` |
| 3. Biological pacing engine | [x] | `feat(engine): add biological pacing and itinerary engine` |
| 4. TinyFish 3-worker SSE route | [x] | `feat(api): add parallel 3-worker TinyFish SSE swarm` |
| 5. Header, constraint rail, page layout | [x] | `feat(ui): add header and biological constraint sidebar` |
| 6. Live agent swarm monitor | [x] | `feat(ui): add live TinyFish agent iframes and findings cards` |
| 7. KPI strip and paced itinerary | [x] | `feat(ui): add safety KPIs, paced itinerary cards, and care card export` |
| 8. Documentation and identity audit | [x] | `docs(agents): finalize AGENTS.md for future coding agents` |

## 3. Commands

Run these from the repository root; all are non-interactive.

```bash
npm install --include=dev   # dev deps need --include=dev when NODE_ENV=production
npm run dev                 # next dev; background only during automation
npm run typecheck           # tsc --noEmit
npm test                    # vitest run, never watch
npm run lint                # eslint
npm run build               # next build
npm run typecheck && npm test && npm run lint && npm run build   # full gate
```

Never foreground the dev server during automation: use a background log, probe with
`curl --max-time`, then stop it. Use `vitest run`. Do not push.

## 4. Environment

| Variable | Where used | When missing |
| --- | --- | --- |
| `TINYFISH_API_KEY` | Server only, `app/api/travel-swarm/route.ts` | Each worker emits `worker_error` code `missing_api_key`; the stream still returns 200. Never log, echo, or commit it. |
| `SWARM_MOCK` | Server only, swarm route | Only when `1` and `NODE_ENV !== "production"`; mock events carry `mock: true`. Ignored in production. |
| `NODE_ENV` | Next.js, swarm mock guard | Next sets it; production disables mock mode. |

`.env.example` is committed; `.env*` is ignored except it. Never read, print, or commit a real
`.env*` file. Local use: `cp .env.example .env.local`, set `TINYFISH_API_KEY`, run `npm run dev`.

## 5. Architecture

Every tracked source file, annotated; `package-lock.json` and generated files
(`next-env.d.ts`, `.next`, `tsconfig.tsbuildinfo`) are omitted by category.

```text
app/  globals.css, layout.tsx, page.tsx, api/travel-swarm/route.ts
lib/  engine: healthTripEngine.ts (entry), healthTripTypes.ts, types.ts, conditionProfiles.ts, sunLifeRules.ts, healthScore.ts, itineraryBuilder.ts
      swarm: swarmTypes.ts (wire contracts), swarmState.ts, swarmReducer.ts, swarmRunner.ts, swarmGoals.ts, swarmMock.ts, sse.ts, tinyfish.ts, tinyfishEvents.ts
      output: describeTrip.ts, pacingStrip.ts, careCard.ts
hooks/  useSwarm.ts, swarmStream.ts, swarmFrames.ts
components/  AgentSwarmMonitor.tsx, ConstraintSidebar.tsx, ItineraryBoard.tsx, PacingStrip.tsx, WorkerFindings.tsx, WorkerLivePanel.tsx
components/ui/  index.ts, Button.tsx, Callout.tsx, Checkbox.tsx, DataRow.tsx, Field.tsx, Metric.tsx, SectionHeader.tsx, Select.tsx, Skeleton.tsx, Slider.tsx, StatusGlyph.tsx, TextInput.tsx, sliderFill.ts (sliderFillPercent), metricBars.ts (metricBarWidths)
tests/  contrast.test.ts, design-guard.test.ts, smoke.test.ts, swarm-route.test.ts, swarm-runner.test.ts, swarm-runner-abort.test.ts, healthTripFixtures.ts, swarm-route-fixtures.ts
module tests  lib/: careCard.test.ts, describeTrip.test.ts, healthTripEngine.test.ts, healthTripEngineRules.test.ts, pacingStrip.test.ts, swarmGoals.test.ts, swarmReducer.test.ts, swarmReducerResults.test.ts, tinyfish.test.ts, tinyfishEvents.test.ts; components/ui/: sliderFill.test.ts, metricBars.test.ts; hooks/: swarmFrames.test.ts
root  package.json, tsconfig.json, next.config.ts, eslint.config.mjs, vitest.config.mts, .env.example, .gitignore, README.md, AGENTS.md, BUILD_LOG.md
```

Data flow: page state -> `buildHealthTripPlan` (pure, memoized) -> plan and Sun Life alert;
Deploy increments `deployNonce`, so `AgentSwarmMonitor` POSTs `/api/travel-swarm`; worker SSE
flows through `useSwarm`/`swarmReducer` to columns, iframes, and findings; the plan feeds
`ItineraryBoard`. The itinerary renders from the engine alone, independent of agent results.

### Biological pacing engine

`buildHealthTripPlan(input)` is pure and deterministic: no I/O, `Date`, `Math.random`, or
locale output. Invalid input throws `HealthTripInputError`; a day over its caps throws
`ItineraryInvariantError`. `@/lib/healthTripEngine` re-exports the public API.

`lib/healthScore.ts` holds the documented formula: weighted exposure, exertion, recovery,
and trip-length pressure over a modeled baseline; scores are rounded, clamped 0-100, and
never clinical validation. The plan is conservative: peak modeled load stays below half the
exposure ceiling with full daily recovery, so exposure and recovery terms are zero for
supported plans; synthetic tests cover them. `kmPerStep` is 0.0005 and only acclimation,
cultural, and transit blocks count steps.

| Condition | Steps/day | Walking | Recovery | Floor | Rationale |
| --- | --- | --- | --- | --- | --- |
| `asthma_respiratory` | 7,000 | 4.0 km | 30 min, required | 22 | Breath-limited ceiling with a short afternoon recovery. |
| `chronic_fatigue_pots` | 4,000 | 2.5 km | 90 min, required | 25 | Low load with a long recovery for orthostatic symptoms. |
| `pregnancy_second_trimester` | 5,000 | 3.0 km | 45 min, required | 18 | Moderate load with rest, heat limits, and food safety. |
| `severe_food_allergy` | 6,000 | 3.5 km | 30 min, optional | 20 | Flexible recovery; emergency planning matters more. |
| `cardiac_hypertension` | 5,000 | 3.0 km | 45 min, required | 22 | Moderate load with midday recovery and altitude limits. |

`PACING_POLICY`: first-day 0.45, middle 0.8, final 0.4 of the ceiling. To add a condition:
add the id and label in `lib/types.ts`; add a readonly profile with a VERIFY line and floor;
add a generic medication name and `CONDITION_CHECKPOINTS` entry; update this table and
section 9; run both engine test files. Exhaustive `Record<Condition, ...>` types fail
typecheck until complete.

### Home page and constraint rail

`app/page.tsx` owns every planner input: destination, days (4; slider 2-7), condition,
medication, `medicationTouched`, `hasSunLifeTravelCoverage`, `deployNonce` (0), `railOpen` (true; mobile
panel). The plan is memoized only while the destination is non-empty; otherwise the alert
comes from `checkSunLifeCoverage`. A condition change rewrites the default medication only
while `medicationTouched` is false. `ConstraintSidebar` is stateless: values, alert,
callbacks, and `onDeploy` in; Deploy increments `deployNonce`, which the monitor receives as
`runToken`. `describeTrip` builds the headline; Pacing puts `CareCardButton` in the
SectionHeader action and `ItineraryBoard` below; Verification renders `AgentSwarmMonitor`.
An empty destination keeps a designed empty message and never deploys.

Below 1024 the rail is a controlled `<details open>` above the main column, summary = trip
sentence. At 1024+ it is `320px / 1px / fluid` with 64px gaps; the rail is sticky at
`top: 88px`, scrolls, and is at most `calc(100vh - 112px)` tall. The sister link is in the
header from 640px, footer below. Gutters 24/40px; section gaps 64/96px from 768px; the footer
sits 64px/96px below.

### Agent swarm monitor

`AgentSwarmMonitor` receives destination, condition, medication, and `runToken` (0 before
Deploy); token 0 shows the empty state and never fetches. A new token with a destination
resets all workers, snapshots input, and starts; Retry reuses that snapshot with one worker.
It shows "Last run: destination, condition, medication" and warns "Inputs changed since this
run. Deploy again to verify." when inputs differ.

Worker state machine (pure `lib/swarmReducer.ts`):

```text
idle --run_started--> queued --worker_status(running)--> running
queued/running --worker_complete--> complete
queued/running --worker_error or stream_failed--> error
complete/error --run_started (same worker)--> queued
```

Worker events are accepted only from queued or running; `run_started` is the only exit from
idle. Progress keeps the last three purposes. `streaming_url` accepts only https on
`mock.invalid` or `*.unikraft.app` (VERIFY) in `lib/swarmState.ts` and `hooks/swarmFrames.ts`;
all other hosts are rejected. `swarm_done` stores completed and failed lists. Any `mock: true`
payload shows the "Mock data" caution Callout; a full run clears it.

A live frame is 16:10 on surface, 1px hairline-strong, 4px radius, with a 28px bar: accent
pulse dot, LIVE, and preview host (hidden below 1280px). Preparing uses a muted dot and
PREPARING. The iframe sets `referrerPolicy="no-referrer"`, `loading="lazy"`, and
`sandbox="allow-scripts allow-same-origin"`. Completion shows findings, source link,
retrieved time, and a raw JSON toggle.

### KPI strip and paced itinerary

`ItineraryBoard` derives everything from `plan`; agent results never feed it. The KPI strip
shows Health Safety Score (`/100`, baseline compare bars), Daily Step Ceiling (`steps`), and
Flare / ER Risk Reduction (`%`), both modeled figures with a "Modeled estimate" sub-line and
an input tooltip. It is three-up at 768-1023px and 1280px+, and stacks below 768px and at
1024-1279px.

Each day is a hairline row, not a card: a 64px day number using `.t-metric-day`, title, pacing
rule, strip, block list, and accent-soft checkpoint. A 160px column carries step and walk caps
as stacked DataRows (one-decimal km); mobile shows two columns. `.day-row` applies the global
240ms rise and 40ms stagger; reduced motion disables both. The inline SVG strip in
`components/PacingStrip.tsx` has a 64px plot, an HTML 16px axis, ink bars at `exertion / 3`, a hatched
12px recovery bar, and two-hour labels from 08:00. The block list is its text equivalent.

`CareCardButton` is the SectionHeader action. `buildCareCard` is pure and deterministic:
title, trip facts, blank line, Sun Life alert, blank line, `Daily checkpoints`, one
`Day <n> (step cap <n> steps): <checkpoint>` line per day, blank line, planning notice (exact
text in `lib/careCard.ts`). With no days it prints `No itinerary days are available.` Copy
uses `navigator.clipboard.writeText` with a two-second "Copied" label and a live status
announcement; on failure a read-only textarea shows the text. That fallback is the only raw
control outside `components/ui` and carries a `design-guard-ignore` comment.

## 6. Key decisions

- **Stack:** Next.js 16.4.6, React 19.3.0, Tailwind 4.3.3, strict TypeScript, Vitest
  4.1.12. Tailwind v4 uses `@theme inline`; there is no `tailwind.config`, and the generated
  Turbopack CSS rule stays in `next.config.ts`. Fonts are local Fontsource families, not
  `next/font/google`, so builds need no network.
- **Vitest 4, not 5:** the scaffold pins `@types/node@^20`; Vitest 5 needs `>=22`, and Vitest
  4 avoids `--legacy-peer-deps`.
- **Scaffold in place:** `.git` and a user-owned `README.md` existed; the README is untouched.
  Generated `cacheComponents` and `partialPrefetching` were removed.
- **Sun Life:** the stability window was not supplied and stays `null`; alerts say so. Never
  invent a number. One `SUN_LIFE_RULES` serves engine and workers.
- **Engine split:** profiles, score, itinerary, types, and rules are separate files under 250
  lines; the public entry re-exports.
- **No live key:** tests and `SWARM_MOCK=1` only; never call TinyFish from automated checks.
- **Primitive-only UI:** compose `components/ui`; raw form controls live only there. Button
  `lg` (48px) exists only for Deploy.
- **No CSS modules:** the Tailwind Turbopack loader returns empty class-name exports, so
  `.slider-range`, `.skeleton-pulse`, `.status-pulse`, and `.t-metric-day` live in
  `app/globals.css`. Do not add CSS modules.
- **DataRow:** default 120px label row; `layout="stacked"` serves worker panes and caps. The
  Metric tooltip uses inline utilities and state so it can dismiss and hover.

## 7. Conventions

### Commits

One step per commit, exact message from section 2; only the orchestrator commits. Never push,
force, or change git config. Stage no `.env*` except `.env.example`, no `node_modules`, no
build output; never `--no-verify`.

### TypeScript and code

- Strict TypeScript. No `any`. No unexplained non-null assertions.
- Named exports in `lib/`; files under about 250 lines; small components.
- Every `lib/` module opens with a header comment (purpose, inputs/outputs, invariants) and
  TSDoc on every exported function and type. Comment why, not what.
- Every `// VERIFY:` states what to check and where; add it to section 9. Compose
  `components/ui`; never restyle a raw control.

### Paper and Ink design system

Tokens live once in `app/globals.css`, exposed through `@theme inline`: `paper`, `surface`,
`sunken`, `ink`, `ink-hover`, `muted`, `hairline`, `hairline-strong`, `accent`, `accent-hover`,
`accent-soft`, `on-accent`, `caution`, `caution-bar`, `risk`. No raw hex in components. Blue
means recovery and action; accent is never body text. Type classes are the only text sizes;
never use Tailwind `text-sm`, `text-xl`, and so on.

| Class | Role |
| --- | --- |
| `.t-display` | Instrument Serif 400, 56/60 desktop, 36/40 mobile. Page headline only. |
| `.t-title` | Instrument Serif 400, 32/36 desktop, 26/30 mobile. Section titles. |
| `.t-wordmark` | Instrument Serif 400, 26/30 at every viewport. Header wordmark. |
| `.t-metric` | Instrument Serif 400, 72/72 desktop, 56/56 mobile, tabular numerals. |
| `.t-metric-day` | Instrument Serif 400, 56/56 desktop, 40/40 mobile. Itinerary day numbers. |
| `.t-heading` | Hanken Grotesk 600, 17/24. |
| `.t-body` | Hanken Grotesk 400, 15/24, max measure 65ch. |
| `.t-small` | Hanken Grotesk 400, 13/20. |
| `.t-button` | Hanken Grotesk 500, 14/20. Button labels only. |
| `.t-label` | IBM Plex Mono 500, 11/16, uppercase, 0.08em tracking. |
| `.t-data` | IBM Plex Mono 400, 13/20, tabular numerals. |
| `.t-data-sm` | IBM Plex Mono 400, 11/16, tabular numerals. Ticks, axes, captions. |

Layout: `.page-container` is max 1200px with 24/40px gutters; `.measure` caps a line at 65ch.
Spacing is multiples of 4px; section gaps are 96px desktop, 64px mobile. Radius 4px for
frames, code, and callouts, 6px for buttons. Hairlines and whitespace only, never shadows.
Focus is a 2px accent outline; motion is an 8px, 240ms day-row rise with a 40ms stagger, and
150ms color transitions, all off under reduced motion.

Banned: gradients, blur, glow, shadows, emoji, flags, stock imagery, illustrations, purple,
centered heroes, feature-card grids, pill badges, marketing words (unlock, supercharge,
seamless, revolutionize, welcome to), lorem ipsum, default Tailwind palette colors, default
Tailwind text sizes, raw hex in components.

### Accessibility and copy

WCAG AA contrast. Every control is keyboard reachable and labelled; tap targets at least 44px.
No text under 13px except 11px mono labels. Every async surface has designed empty, loading,
error, and success states. Copy is calm, specific, sentence case, without exclamation marks or
emoji; sentences stay under 20 words. Numbers carry units. `healthSafetyScore` and
`riskReductionPct` are always labelled "Modeled estimate" with a tooltip listing inputs.

### Guard tests

`tests/design-guard.test.ts` scans `app/**/*.{ts,tsx,css}` (except `app/globals.css`) and
`components/**/*.tsx`. It fails with `file:line` on default palette variants, raw white/black,
hex/rgb/hsl and arbitrary colors, default and arbitrary text sizes, unapproved weights, shadows
except `shadow-none`, gradients and blur, radii outside `none`/`frame`/`control`, pill radii
outside `components/ui`, raw form controls outside `components/ui`, emoji, flags, images, and
banned marketing copy. `design-guard-ignore` exempts a line. Nineteen banned and four allowed
fixtures prove the rules. `tests/contrast.test.ts` checks 13 pairs at 4.5:1 or better.

## 8. Medical safety rules

- The product is a planning aid, not medical advice. The persistent footer reads: "Planning
  aid only. Not medical advice. Confirm with your clinician and insurer before you travel."
- All physiological thresholds live in one typed `CONDITION_PROFILES` constant in
  `lib/conditionProfiles.ts`, each with a rationale, a modeled residual-risk floor, and a
  `// VERIFY:` flag. No magic numbers elsewhere.
- `healthSafetyScore` and `riskReductionPct` are deterministic modeled estimates from the
  documented formula. Label them "Modeled estimate" with an input tooltip. Never call them
  measured or clinically validated.
- Insurance rules (60-day cap, Allianz Global Assistance 24/7 pre-authorization, the
  pre-existing stability window) live in one `SUN_LIFE_RULES` constant in
  `lib/sunLifeRules.ts`, marked `// VERIFY against current group policy`. The window is
  `null` and unconfirmed. The alert says "Verify with your plan administrator".
- Never suggest doses or medication changes. Medication information is limited to generic
  and brand names, customs, and carry rules.
- Agent findings show the source URL and retrieved time. Missing fields show "Not found",
  never a guess. Malformed JSON shows the raw text plus a parse error.

## 9. VERIFY register

Regenerate with `grep -rn "VERIFY:" app lib components`; there are 8 entries.

| File | What to verify |
| --- | --- |
| `lib/conditionProfiles.ts` (asthma) | floor 22; 7,000-step ceiling, 4.0 km walking, 30-minute recovery, altitude, heat, and allergens against respiratory guidance. |
| `lib/conditionProfiles.ts` (POTS) | floor 25; 4,000-step ceiling, 2.5 km walking, 90-minute recovery, altitude, heat, and allergens against autonomic guidance. |
| `lib/conditionProfiles.ts` (pregnancy) | floor 18; 5,000-step ceiling, 3.0 km walking, 45-minute recovery, altitude, heat, and food safety against maternity guidance. |
| `lib/conditionProfiles.ts` (food allergy) | floor 20; 6,000-step ceiling, 3.5 km walking, 30-minute optional recovery, heat, and allergens against allergy guidance. |
| `lib/conditionProfiles.ts` (cardiac) | floor 22; 5,000-step ceiling, 3.0 km walking, 45-minute recovery, altitude, heat, and sodium/allergens against cardiology guidance. |
| `lib/sunLifeRules.ts` (stability placeholder) | The window is `null`; confirm the real value with the plan administrator. Never invent a number. |
| `lib/sunLifeRules.ts` (rules) | 60-day cap, Allianz 24/7 pre-authorization, and stability window against current group policy; record source and checked date. |
| `lib/swarmState.ts` (preview allowlist) | Confirm the production TinyFish preview host family still ends in `.unikraft.app`; `mock.invalid` is the mock-mode host. |

## 10. External integrations

TinyFish Web Agent API: `POST https://agent.tinyfish.ai/v1/automation/run-sse` with
`X-API-Key` and JSON `{url, goal, output_schema?}`. The key is read only in the route; never
log or echo it. `output_schema` is a top-level object using `nullable: true`, never type
arrays, `oneOf`, `const`, or `additionalProperties`.

Upstream `data: <json>` events: `STARTED` (run_id), `STREAMING_URL`, `PROGRESS` (purpose),
`HEARTBEAT`, `COMPLETE` (status/result/error), and optional `TF_API_RESULT`. Unknown types are
ignored; `COMPLETE.result` is authoritative. The route forwards absolute http(s) STREAMING_URL
values; the browser keeps only https `mock.invalid` or `*.unikraft.app` previews.

Our SSE frames all carry `worker`, an ISO `ts`, and optional `mock`; `swarm_done` uses
`worker: "swarm"` and is always last on a connected stream.

| Event | Fields | When |
| --- | --- | --- |
| `worker_status` | `status` (queued/running) | Before a run and on TinyFish STARTED. |
| `streaming_url` | `streamingUrl` | An absolute http(s) STREAMING_URL arrives; the browser keeps allowlisted https previews. |
| `worker_progress` | `purpose` | TinyFish PROGRESS. |
| `worker_complete` | `findings`, `sourceUrl`, `retrievedAt`, `rawResult?`, `parseError?` | COMPLETED. Malformed JSON keeps raw text and parse error. |
| `worker_error` | `code`, `message` | Missing key, timeout, upstream error, unexpected rejection. |
| `swarm_done` | `completed`, `failed` | Once after all requested workers settle. |

Headers are `text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`, and
`X-Accel-Buffering: no`; a keep-alive comment goes out about every 15s. Disconnect aborts
upstreams. Error codes: `missing_api_key`, `timeout`, `upstream_error`; invalid bodies 400 JSON.

Mock mode needs no key or network; every payload carries `mock: true` and preview URLs use
`mock.invalid`:

```bash
SWARM_MOCK=1 npm run dev
curl -N -X POST http://localhost:3000/api/travel-swarm \
  -H 'Content-Type: application/json' \
  -d '{"destination":"Lisbon, Portugal","condition":"asthma_respiratory","medication":"albuterol inhaler"}'
```

Each live run drives three real browsers; never call it in tests or routine development.
Docs: <https://docs.tinyfish.ai/tinyagent/api/agent/endpoints.md>,
<https://docs.tinyfish.ai/api-reference/automation/run-browser-automation-with-sse-streaming.md>,
<https://docs.tinyfish.ai/live-preview.md>,
<https://docs.tinyfish.ai/tinyagent/api/agent/structured-output.md>.

## 11. Testing

`npm test` runs Vitest once in a Node environment. The suite has 179 tests.

- `tests/design-guard.test.ts` and `tests/contrast.test.ts` guard styles and 13 WCAG AA token
  pairs; `tests/smoke.test.ts` covers the five conditions.
- `lib/healthTripEngine*.test.ts` covers every condition x 2-7 days, caps, invariants,
  recovery, scores, determinism, Sun Life, validation, docs, and re-exports. Shared input is
  in `tests/healthTripFixtures.ts`.
- `lib/tinyfish*.test.ts`, `lib/swarmGoals.test.ts`, `tests/swarm-route*.test.ts`, and
  `tests/swarm-runner*.test.ts` cover parsing, mapping, schemas, normalisation, missing key,
  isolation, retries, mock, timeout, abort, and swarm_done. All network is mocked.
- `lib/swarmReducer*.test.ts`, `hooks/swarmFrames.test.ts`, `lib/pacingStrip.test.ts`,
  `lib/careCard.test.ts`, `lib/describeTrip.test.ts`, and `components/ui/*.test.ts` cover
  transitions, the idle gate, allowlists, geometry, exact care-card text, and headline.

Add pure-function tests beside the module or under `tests/`, named `*.test.ts`; Vitest includes
`**/*.test.ts`. No component-test libraries. Mock fetch in route and SSE tests. Keep the design
guard green rather than exempting lines.

## 12. Known limitations and open questions

- The Sun Life stability window is unknown and stored as `null`; no placeholder number is
  shown. Confirm it with the plan administrator.
- No live TinyFish run, key, iframe preview, clipboard permission, or real SSE stream has been
  exercised. Fixtures and mocked fetch verify event handling; preview URLs may expire.
- The route tolerates unknown events, stringified `result` values, and partial payloads.
- The preview allowlist (`*.unikraft.app`) follows current docs and is marked VERIFY.
- The user-owned `README.md` is untouched; this guide is the working file. Light theme only;
  tokens allow a dark theme later.
- Destination strings are labels only; the engine invents no venues or geography.
- The mobile `<details>` summary repeats the trip sentence; this is the Step 5 contract.
- The KPI strip stacks at 1024-1279px because the 320px rail leaves too little width for
  three 72px metrics; it is three-up at 768-1023px and 1280px+.

## 13. How to work here

1. Read this file, then `BUILD_LOG.md`.
2. Run `git log --oneline`, `git status`, and `git diff`; never discard uncommitted work.
3. Find the first unchecked step in section 2 and continue there.
4. Work in dependency order; no scope creep into pages, auth, databases, analytics, or libraries.
5. Run the full gate; update this file in the same commit as any change it describes.
6. Commit the exact message; append to `BUILD_LOG.md` and set its "Next action".
7. Stuck: three attempts, then change approach once, then log the error under Blockers. Never loop.
