# AGENTS.md

The single source of truth for PlanMyTrip.health. Read this first, then `BUILD_LOG.md` for
the current step and decisions. Update this file in the same commit as any change.

## 1. What this is

PlanMyTrip.health is a health-first travel planner for patients and caregivers, often
anxious, on a phone or laptop. It does three jobs: a team of OpenCode specialists plans the
trip, the biological engine turns condition limits into a paced safety envelope, and three
parallel TinyFish browser agents verify live travel risk while the user watches.

It is a planning aid, never medical advice: a well-typeset clinical chart crossed with a Swiss
timetable, typographic and ruled with hairlines. The pacing strip and the numbered route map
are the signature elements. The concierge plans venues and sequence; the engine owns the
physiological ceiling. See section 7.

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
| 9. Agentic concierge and trip map | [x] | `feat(planner): add OpenCode concierge team and trip map` |

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
`curl --max-time`, then stop it. Use `vitest run`. After a feature is complete, commit and push
to `origin`; never force-push. Live planning needs an authenticated OpenCode service; the app
discovers or starts the local one. Use `AGENT_MOCK=1` when no service or model should be called.

## 4. Environment

| Variable | Where used | When missing |
| --- | --- | --- |
| `TINYFISH_API_KEY` | Server only, `app/api/travel-swarm/route.ts` | Each worker emits `worker_error` code `missing_api_key`; the stream still returns 200. Never log, echo, or commit it. |
| `SWARM_MOCK` | Server only, swarm route | Only when `1` and `NODE_ENV !== "production"`; mock events carry `mock: true`. Ignored in production. |
| `AGENT_MOCK` | Server only, planner route | Only when `1` and `NODE_ENV !== "production"`; every planner payload carries `mock: true`. Ignored in production. |
| `OPENCODE_SERVER_URL` | Server only, `lib/agent/agentClient.ts` | When empty, the app discovers or starts the local OpenCode service. |
| `OPENCODE_SERVER_USERNAME` / `OPENCODE_SERVER_PASSWORD` | Server only, explicit OpenCode server | Optional Basic auth for an explicit server. Never log or commit them. |
| `OPENCODE_MODEL` | Server only, planner sessions | Optional `provider/model`; when empty the service default is used. The default free model can hit a quota, so production should set a paid model. |
| `OPENCODE_MODEL_VARIANT` | Server only, planner sessions | Optional model variant passed with `OPENCODE_MODEL`. |
| `NOMINATIM_URL` | Server only, geocoder | Defaults to the public Nominatim endpoint; production should use a licensed endpoint. |
| `NOMINATIM_USER_AGENT` | Server only, geocoder | Defaults to `PlanMyTrip.health/0.1 (travel planning; contact@planmytrip.health)`. |
| `NEXT_PUBLIC_MAP_TILE_URL` | Browser, `components/TripMap.tsx` | Defaults to public OpenStreetMap tiles; production should use a licensed tile endpoint. |
| `NEXT_PUBLIC_MAP_ATTRIBUTION` | Browser, `components/TripMap.tsx` | Defaults to the OpenStreetMap attribution. |
| `NODE_ENV` | Next.js, mock guards | Next sets it; production disables both mock modes. |

`.env.example` is committed; `.env*` is ignored except it. Never read, print, or commit a real
`.env*` file. Local use: `cp .env.example .env.local`, set `TINYFISH_API_KEY`, optionally set
`OPENCODE_MODEL`, run `npm run dev`. The OpenCode service must be installed and authenticated
for live planning; `AGENT_MOCK=1` needs neither a key nor a service.

## 5. Architecture

Every tracked source file, annotated; `package-lock.json` and generated files
(`next-env.d.ts`, `.next`, `tsconfig.tsbuildinfo`) are omitted by category.

```text
app/  globals.css, layout.tsx, page.tsx, api/travel-swarm/route.ts, api/agent-plan/route.ts
lib/  engine: healthTripEngine.ts (entry), healthTripTypes.ts, types.ts, conditionProfiles.ts, sunLifeRules.ts, healthScore.ts, itineraryBuilder.ts
      swarm: swarmTypes.ts (wire contracts), swarmState.ts, swarmReducer.ts, swarmRunner.ts, swarmGoals.ts, swarmMock.ts, sse.ts, tinyfish.ts, tinyfishEvents.ts
      agent: agentTypes.ts (wire contracts), agentRequest.ts, agentProfiles.ts, agentPrompts.ts, agentConfig.ts, agentClient.ts, agentRunner.ts, agentSession.ts, agentParse.ts, agentPlanParse.ts, agentFallback.ts, agentGeocode.ts, agentEvents.ts, agentMock.ts, plannerReducer.ts
      output: describeTrip.ts, pacingStrip.ts, careCard.ts
hooks/  useSwarm.ts, swarmStream.ts, swarmFrames.ts, useAgentPlan.ts, plannerStream.ts, plannerFrames.ts
components/  AgentPlanner.tsx, AgentRoster.tsx, AgentActivityFeed.tsx, AgentPlanView.tsx, AgentPlanDays.tsx, AgentPicks.tsx, TripMap.tsx, AgentSwarmMonitor.tsx, ConstraintSidebar.tsx, ItineraryBoard.tsx, PacingStrip.tsx, WorkerFindings.tsx, WorkerLivePanel.tsx
components/ui/  index.ts, Button.tsx, Callout.tsx, Checkbox.tsx, DataRow.tsx, Field.tsx, Metric.tsx, SectionHeader.tsx, Select.tsx, Skeleton.tsx, Slider.tsx, StatusGlyph.tsx, TextInput.tsx, sliderFill.ts (sliderFillPercent), metricBars.ts (metricBarWidths)
tests/  contrast.test.ts, design-guard.test.ts, smoke.test.ts, swarm-route.test.ts, swarm-runner.test.ts, swarm-runner-abort.test.ts, agent-route.test.ts, healthTripFixtures.ts, swarm-route-fixtures.ts
module tests  lib/: careCard.test.ts, describeTrip.test.ts, healthTripEngine.test.ts, healthTripEngineRules.test.ts, pacingStrip.test.ts, swarmGoals.test.ts, swarmReducer.test.ts, swarmReducerResults.test.ts, tinyfish.test.ts, tinyfishEvents.test.ts; lib/agent/: agentRequest.test.ts, agentParse.test.ts, agentPlanParse.test.ts, agentFallback.test.ts, agentEvents.test.ts, agentPrompts.test.ts, agentGeocode.test.ts, plannerReducer.test.ts; components/ui/: sliderFill.test.ts, metricBars.test.ts; hooks/: swarmFrames.test.ts, plannerFrames.test.ts
root  package.json, tsconfig.json, next.config.ts, eslint.config.mjs, vitest.config.mts, .env.example, .gitignore, README.md, AGENTS.md, BUILD_LOG.md
```

Data flow: page state -> `buildHealthTripPlan` (pure, memoized) -> plan and Sun Life alert;
Deploy increments `deployNonce`, so `AgentPlanner` POSTs `/api/agent-plan` and
`AgentSwarmMonitor` POSTs `/api/travel-swarm` with the same token. Planner events flow through
`useAgentPlan`/`plannerFrames`/`plannerReducer` into the roster, live log, map, and plan;
TinyFish events flow through `useSwarm`/`swarmReducer` into columns, iframes, and findings.
The engine plan feeds `ItineraryBoard` and supplies every concierge day with its step and
walking ceiling. The engine and the safety envelope render independently of both agent teams.

### Agentic concierge

`lib/agent/agentRunner.ts` owns the live run. It discovers or starts an OpenCode service via
`@opencode/client`, writes seven agent definitions into a temporary workspace, and runs six
research specialists in parallel: stay, table, trail, culture, transit, and care. Each is a
separate OpenCode session with its own system prompt, source rules, and JSON shape. The lead
concierge then receives the verified research plus the engine's day ceilings and returns one
sequenced plan.

The specialists may use `websearch` and `webfetch` only. The generated `.opencode/opencode.json`
denies `*` first and allows those two actions; shell, file writes, edits, and subagents stay
closed. The API key and provider credentials never enter this repo; the OpenCode service owns
them. The workspace lives under the system temp directory, not the app repo.

Events are the planner SSE contract: `planner_started` (seven-agent roster), `agent_started`,
`agent_status` (queued/researching/writing/complete/error), `agent_activity` (one bounded,
human-readable search/read/note/error line), `agent_result`, `plan_ready`, `planner_error`, and
`planner_done` always last. The runner streams activity only from tool calls and prose deltas;
reasoning is not exposed. It collects the last assistant text, parses one JSON object, bounds
every list, and validates coordinates. A failed specialist is isolated; the concierge still
runs if any research survives. If synthesis fails, `buildFallbackPlan` assembles a degraded
route from the verified picks and the engine caps.

Timeouts are 360s per specialist and 300s for the concierge; `/api/agent-plan` declares
`maxDuration = 900`. `OPENCODE_MODEL` selects a `provider/model` and is passed explicitly to
every session so a slow config reload cannot silently fall back to the free model. A provider
quota failure becomes `agent_unavailable`, not an invented plan. `AGENT_MOCK=1` scripts the same
events and a full sample plan with no service or network.

`geocodePlan` fills missing coordinates for up to ten selected places through Nominatim at one
request per second, with an identifying User-Agent; it never guesses a location and marks each
resolved place `geocoded: true`. The fallback map lists only verified or geocoded coordinates.

`TripMap` is a client-only Leaflet view with grayscale OSM tiles, category-shaped numbered
markers, a 44px hit area, one dashed route per day, a category legend, a numbered key, and the
required attribution. The Leaflet flag prefix is disabled. Tiles and geocoding are production
dependencies with licences to verify; see section 9.

The planned UI puts the finished plan first, with the roster collapsed under "Research team".
While the run is live, the roster and bounded activity log lead; the safety-envelope Pacing
section stays below. `AgentPlanView` labels every day with agent estimate, modeled ceiling,
recovery minutes, and the engine checkpoint; a day above its ceiling shows a caution and the
Pacing limit wins.

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
medication, `medicationTouched`, interests, `budget` (balanced), `hasSunLifeTravelCoverage`,
`deployNonce` (0), `railOpen` (true; mobile panel). The plan is memoized only while the
destination is non-empty; otherwise the alert comes from `checkSunLifeCoverage`. A condition
change rewrites the default medication only while `medicationTouched` is false.
`ConstraintSidebar` is stateless: values, alert, callbacks, and `onDeploy` in; Deploy increments
`deployNonce`, which both `AgentPlanner` and `AgentSwarmMonitor` receive as `runToken`.
`describeTrip` builds the headline. Section 01 Concierge renders `AgentPlanner`; section 02
Pacing puts `CareCardButton` in the SectionHeader action and `ItineraryBoard` below; section 03
Verification renders `AgentSwarmMonitor`. An empty destination keeps a designed empty message
and never deploys. The rail's primary action reads "Plan my trip"; inputs and the budget feed
the concierge prompts, not the deterministic engine.

Deploying runs the concierge and the three live risk checks concurrently. The engine safety
envelope is already visible before either team finishes.

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
`mock.invalid`, `*.unikraft.app`, or `*.tinyfish.io` (VERIFY) in `lib/swarmState.ts` and
`hooks/swarmFrames.ts`; all other hosts are rejected. Live workers abort after 240s so slow
browser runs can still finish; `/api/travel-swarm` declares `maxDuration = 300`. `swarm_done`
stores completed and failed lists. Any `mock: true` payload shows the "Mock data" caution
Callout; a full run clears it.

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
- **No live key:** tests, `SWARM_MOCK=1`, and `AGENT_MOCK=1` only; never call TinyFish or the
  planner model from automated checks.
- **OpenCode client, not embedded host:** `@opencode/sdk` needs Node 26 for `await using`; this
  runtime is Node 22. `@opencode/client` against the OpenCode service is the same API contract
  and streams the same events. The service owns credentials; the app never sees them.
- **Read-only agents:** the consenting research agents get web search and page fetch only. No
  shell, file write, edit, or subagent permission. The temporary workspace is outside the repo.
- **Model is explicit:** `OPENCODE_MODEL` is passed to `session.create`, not only written into
  the config, so an async config reload cannot silently select a free model with a quota.
- **Map without photography:** Leaflet renders grayscale OSM tiles and numbered, token-coloured
  markers. There are no stock images, flags, or decorative illustrations. Tile and geocode
  providers are licence dependencies, not app assets.
- **Primitive-only UI:** compose `components/ui`; raw form controls live only there. Button
  `lg` (48px) exists only for Deploy.
- **No CSS modules:** the Tailwind Turbopack loader returns empty class-name exports, so
  `.slider-range`, `.skeleton-pulse`, `.status-pulse`, and `.t-metric-day` live in
  `app/globals.css`. Do not add CSS modules.
- **DataRow:** default 120px label row; `layout="stacked"` serves worker panes and caps. The
  Metric tooltip uses inline utilities and state so it can dismiss and hover.

## 7. Conventions

### Commits

One step per commit, exact message from section 2; only the orchestrator commits. After a
feature is complete and the full gate is green, push the commit to `origin`. Never force-push
or change git config. Stage no `.env*` except `.env.example`, no `node_modules`, no build
output; never `--no-verify`.

### TypeScript and code

- Strict TypeScript. No `any`. No unexplained non-null assertions.
- Named exports in `lib/`; files generally under about 250 lines; split orchestration,
  parsing, and rendering when a module grows. Small components.
- Every `lib/` module opens with a header comment (purpose, inputs/outputs, invariants) and
  TSDoc on every exported function and type. Comment why, not what.
- Every `// VERIFY:` states what to check and where; add it to section 9. Compose
  `components/ui`; never restyle a raw control.
- Agent prompts and output shapes live in `lib/agent/agentPrompts.ts` and
  `agentProfiles.ts`; parsing, plan building, and rendering stay separate. Never put a raw
  provider error, API key, session token, or full tool input into a frame. Bound every agent
  string and list before it reaches the UI.
- The Leaflet map is client-only and imports its stylesheet in `app/layout.tsx`; its Paper and
  Ink overrides live in `app/globals.css` because CSS modules are banned. Markers are numbered
  DOM icons, not image assets.

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
  and brand names, customs, and carry rules. The concierge prompts forbid telling the traveler
  to take or use a medication; copy refers to the clinician's plan.
- The concierge is a planning aid. Every day carries the engine's step and walking ceiling,
  recovery minutes, and checkpoint. Agent estimates are labelled as estimates; a day above a
  ceiling shows a caution and the Pacing limit always wins.
- Agent findings show the source URL and retrieved time. Missing fields show "Not found",
  never a guess. Malformed JSON shows the raw text plus a parse error.
- Geocoded coordinates are labelled approximate. A place without a verified or geocoded
  coordinate is not plotted; the itinerary list remains the source of truth.

## 9. VERIFY register

Regenerate with `grep -rn "VERIFY:" app lib components`; there are 10 entries.

| File | What to verify |
| --- | --- |
| `lib/conditionProfiles.ts` (asthma) | floor 22; 7,000-step ceiling, 4.0 km walking, 30-minute recovery, altitude, heat, and allergens against respiratory guidance. |
| `lib/conditionProfiles.ts` (POTS) | floor 25; 4,000-step ceiling, 2.5 km walking, 90-minute recovery, altitude, heat, and allergens against autonomic guidance. |
| `lib/conditionProfiles.ts` (pregnancy) | floor 18; 5,000-step ceiling, 3.0 km walking, 45-minute recovery, altitude, heat, and food safety against maternity guidance. |
| `lib/conditionProfiles.ts` (food allergy) | floor 20; 6,000-step ceiling, 3.5 km walking, 30-minute optional recovery, heat, and allergens against allergy guidance. |
| `lib/conditionProfiles.ts` (cardiac) | floor 22; 5,000-step ceiling, 3.0 km walking, 45-minute recovery, altitude, heat, and sodium/allergens against cardiology guidance. |
| `lib/sunLifeRules.ts` (stability placeholder) | The window is `null`; confirm the real value with the plan administrator. Never invent a number. |
| `lib/sunLifeRules.ts` (rules) | 60-day cap, Allianz 24/7 pre-authorization, and stability window against current group policy; record source and checked date. |
| `lib/swarmState.ts` (preview allowlist) | Docs list `*.unikraft.app`; a live production run on 2026-11-21 returned `*.tetra-data.production.tinyfish.io`, so both provider domains are allowlisted. Recheck if TinyFish introduces another host family. |
| `lib/agent/agentGeocode.ts` (Nominatim) | Public Nominatim allows one request per second and requires an identifying User-Agent. Confirm the production geocoder's licence, quota, and attribution. |
| `components/TripMap.tsx` (tiles) | Confirm the production tile licence, attribution text, and request volume. Public OSM tiles are not a high-volume production endpoint. |

## 10. External integrations

OpenCode service: the server uses `@opencode/client` v2.3.2, discovers or starts the local
service with `Service.ensure()`, and writes seven `agents` entries into
`$TMPDIR/planmytrip-health-agent-workspace/.opencode/opencode.json`. Each agent is `mode:
primary`, has a static system prompt and `steps`, and may use only `websearch` and `webfetch`.
`OPENCODE_MODEL` is passed both in the config and explicitly to `session.create`. The service
owns provider credentials; the app never reads, logs, or stores them.

Planner events are the second SSE contract. Every frame carries `ts` and optional `mock`;
`planner_done` is always last.

| Event | Fields | When |
| --- | --- | --- |
| `planner_started` | `agents` | Once before live sessions start. |
| `agent_started` | `agentId`, `sessionId` | A specialist or concierge session opens. |
| `agent_status` | `status`, `message?` | Researching, writing, complete, or error. |
| `agent_activity` | `kind`, `text` | One bounded search, read, note, tool, or error line. |
| `agent_result` | `ok`, `summary` | One specialist or concierge result. |
| `plan_ready` | `plan`, `completed`, `failed` | The final map and day plan. |
| `planner_error` | `code`, `message` | Unavailable, timeout, invalid plan, or upstream failure. |
| `planner_done` | `completed`, `failed` | Once after every run, including errors. |

Planner headers are the same `text/event-stream`, no-cache, and `X-Accel-Buffering: no` set;
keep-alive comments go out about every 15s. Disconnect aborts the event subscription and
interrupts sessions. `/api/agent-plan` declares `maxDuration = 900`.

Geocoding: `geocodePlan` calls `${NOMINATIM_URL}?format=jsonv2&limit=1&q=...` with a custom
User-Agent, at most ten places per plan, sequentially, one second apart, and 7s per request.
A failed lookup leaves `lat` and `lng` null. Map tiles come from `NEXT_PUBLIC_MAP_TILE_URL`
with `NEXT_PUBLIC_MAP_ATTRIBUTION`; the Leaflet attribution prefix is disabled.

TinyFish Web Agent API: `POST https://agent.tinyfish.ai/v1/automation/run-sse` with
`X-API-Key` and JSON `{url, goal, output_schema?}`. The key is read only in the route; never
log or echo it. `output_schema` is a top-level object using `nullable: true`, never type
arrays, `oneOf`, `const`, or `additionalProperties`.

Upstream `data: <json>` events: `STARTED` (run_id), `STREAMING_URL`, `PROGRESS` (purpose),
`HEARTBEAT`, `COMPLETE` (status/result/error), and optional `TF_API_RESULT`. Unknown types are
ignored; `COMPLETE.result` is authoritative. The route forwards absolute http(s) STREAMING_URL
values; the browser keeps only https `mock.invalid`, `*.unikraft.app`, or `*.tinyfish.io`
previews.

TinyFish swarm frames all carry `worker`, an ISO `ts`, and optional `mock`; `swarm_done` uses
`worker: "swarm"` and is always last on a connected stream. Planner frames use `agentId` and
their own `planner_done` terminal frame instead.

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

`npm test` runs Vitest once in a Node environment. The suite has 238 tests.

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
- `lib/agent/*.test.ts` covers request bounds, assistant-text and JSON parsing, specialist
  normalisation, coordinate validation, concierge plan building and wire normalisation, the
  fallback route, prompt safety and limits, tool-activity humanisation, geocoding, and planner
  reducer transitions. `hooks/plannerFrames.test.ts` covers the SSE frame guard.
- `tests/agent-route.test.ts` runs the whole mock planner route through real SSE: roster, seven
  agent starts, activity, plan_ready, mock flags, map coordinates, planner_done last, and 400s
  for bad bodies. No OpenCode service or model call is made.

Add pure-function tests beside the module or under `tests/`, named `*.test.ts`; Vitest includes
`**/*.test.ts`. No component-test libraries. Mock fetch in route and SSE tests; never call the
live planner or TinyFish from an automated check. Keep the design guard green rather than
exempting lines.

## 12. Known limitations and open questions

- The Sun Life stability window is unknown and stored as `null`; no placeholder number is
  shown. Confirm it with the plan administrator.
- A live TinyFish SSE run was verified on 2026-11-21: the key, progress events, and preview
  URL worked; the preview host was `*.tinyfish.io`, and the 110s timeout was raised to 240s
  after a valid advisory run was cut off mid-navigation. A full three-worker run, iframe
  rendering, and clipboard permissions remain unverified.
- The route tolerates unknown events, stringified `result` values, and partial payloads.
- The preview allowlist covers `mock.invalid`, `*.unikraft.app` (docs), and `*.tinyfish.io`
  (verified live 2026-11-21).
- Live concierge run 1 on 2026-11-21 (`OPENCODE_MODEL=opencode-go/deepseek-v4.1-flash`) completed
  six of seven agents in about 10m45s; care timed out. Run 2 finished in about 12 minutes with
  four of seven agents: table, trail, culture, and concierge. Stay, transit, and care returned
  JSON the parser rejected, not timeouts. The plan still produced two capped days, six verified
  places, and honest missing-stay/care copy. After run 2 the parser gained balanced-object
  scanning, trailing-comma repair, and single-element array unwrapping, and geocoding gained a
  simpler fallback query; these fixes are tested but not yet re-run live. Run a full 7-of-7
  pass and a full three-worker TinyFish pass separately.
- The default free model hit a provider quota during development; production must set
  `OPENCODE_MODEL`. A quota failure maps to `agent_unavailable`.
- The embedded `@opencode/sdk` host requires Node 26 for `await using`; this app is on Node 22
  and uses `@opencode/client` against a running OpenCode service. A production deployment must
  provide and supervise that service.
- Geocoding is covered by mocked fetch tests; the live Nominatim pass has not been exercised
  against a real agent plan. Public OSM tiles and Nominatim are not production-scale endpoints.
- The concierge plan is rendered from the current SSE run only; it is not persisted across a
  reload, and there is no account, payment, booking, or rate limiting yet. Those are product
  work beyond this step.
- Consent and privacy: the destination, condition, medication name, and preferences are sent
  to the configured OpenCode model provider; place queries go to Nominatim. Add explicit
  consent, retention, and privacy copy before charging users.
- Agent copy is model-generated and varies. The engine caps, over-cap caution, source links,
  "approximate location" label, and fallback route are the guardrails; do not remove them.
- The user-owned `README.md` is untouched; this guide is the working file. Light theme only;
  tokens allow a dark theme later.
- The engine invents no venues or geography. The concierge only selects from verified research.
- The mobile `<details>` summary repeats the trip sentence; this is the Step 5 contract.
- The KPI strip stacks at 1024-1279px because the 320px rail leaves too little width for
  three 72px metrics; it is three-up at 768-1023px and 1280px+.

## 13. How to work here

1. Read this file, then `BUILD_LOG.md`.
2. Run `git log --oneline`, `git status`, and `git diff`; never discard uncommitted work.
3. Find the first unchecked step in section 2 and continue there.
4. Work in dependency order; no scope creep into pages, auth, databases, analytics, or libraries.
5. Run the full gate; update this file in the same commit as any change it describes.
6. Commit the exact message, push to `origin`, append to `BUILD_LOG.md`, and set its "Next action".
7. Stuck: three attempts, then change approach once, then log the error under Blockers. Never loop.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
