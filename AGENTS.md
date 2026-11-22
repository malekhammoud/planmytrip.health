# AGENTS.md

The single source of truth for PlanMyTrip.health. Read this first, then `BUILD_LOG.md` for
the current step and decisions. Update this file in the same commit as any change.

## 1. What this is

PlanMyTrip.health is a health-first travel planner for patients and caregivers, often
anxious, on a phone or laptop. It does four jobs: a team of OpenCode specialists plans the
trip, the biological engine turns condition limits into a paced safety envelope, three
parallel TinyFish browser agents verify live travel risk while the user watches, and a
consented outcome loop calibrates the pacing estimate against what actually happened.

It is a planning aid, never medical advice: a well-typeset clinical chart crossed with a Swiss
timetable, typographic and ruled with hairlines. The pacing strip and the numbered route map
are the signature elements. The concierge plans venues and sequence; the engine owns the
physiological ceiling. See section 7.

The data loop is part of the product, not analytics: one consented dossier per run, one
explicit outcome per trip, and a versioned calibration artifact. The computed dose is the
asset; an agent's self-reported step count never enters a training row. See `docs/ML.md`.
Planning requires a Clerk account. Saved trips are account-owned snapshots; the consented
research capture stays anonymous and separate. See `docs/AUTH.md`.

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
| 10. Onboarding and tabbed workspace | [x] | `feat(ui): add onboarding flow and tabbed trip workspace` |
| 11. Production specialist hardening | [x] | `fix(planner): harden production agent runs` |
| 12. ML data loop and calibrated model | [x] | `feat(ml): add trip outcome data loop and calibrated flare model` |
| 13. One-page live workspace and agent warmup | [x] | `feat(ui): add live one-page planning workspace` |
| 14. Full TinyFish telemetry | [x] | `feat(api): stream full TinyFish telemetry with limits and mock timeline` |
| 15. Live swarm telemetry model | [x] | `feat(state): add live swarm telemetry model` |
| 16. Mission control | [x] | `feat(ui): add live mission control for agent swarm` |
| 17. Verification overlay | [x] | `feat(engine): add tighten-only live verification overlay` |
| 18. Animated plan changes | [x] | `feat(ui): animate plan changes and live adjustments` |
| 19. Mission control docs | [x] | `docs(agents): document live mission control and telemetry` |
| 20. Production readiness and nested calibration | [x] | `fix(ml): harden calibration and capture integrity` |
| 21. Transport-aware route and Maps handoff | [x] | `feat(route): add transport-aware route optimization and Google Maps handoff` |
| 22. Paper and Ink pitch deck | [x] | `feat(pitch): add Paper and Ink pitch deck at /pitch` |
| 23. Live command surface | [x] | `feat(ui): rebuild workspace as a live command surface` |
| 24. Clerk accounts and saved trips | [x] | `feat(auth): add Clerk accounts and saved trips` |
| 25. Clerk form appearance | [x] | `fix(auth): use visible Clerk appearance tokens` |
| 26. TinyFish live-check recovery | [x] | `fix(api): stop sending beta-gated TinyFish max steps` |
| 27. Collapsing live surfaces | [x] | `feat(ui): collapse completed work into live disclosures` |
| 28. Instant cached plans and verification | [x] | `feat(cache): add instant cached plans and recorded verification` |
| 29. Location autocomplete and map picker | [x] | `feat(onboarding): add location autocomplete and map picker` |
| 30. Starting-point location tools | [x] | `feat(onboarding): add location tools to starting point` |
| 31. Numeric duration and budget slider | [x] | `feat(onboarding): use a day field and budget slider` |
| 32. Consistent TinyFish recovery | [x] | `fix(api): recover interrupted TinyFish runs and retry once` |
| 33. Exact current starting point | [x] | `fix(onboarding): use exact current location for starting point` |
| 34. Trips up to 20 days | [x] | `feat(engine): support trips up to 20 days` |

## 3. Commands

Run these from the repository root; all are non-interactive.

```bash
npm install --include=dev   # dev deps need --include=dev when NODE_ENV=production
npm run dev                 # next dev; background only during automation
npm run typecheck           # tsc --noEmit
npm test                    # vitest run, never watch
npm run lint                # eslint
npm run build               # next build
npm run db:init             # apply the idempotent PostgreSQL schema
npx -y clerk@latest doctor  # verify Clerk keys and integration; app resources need auth login
npm run data:synthetic      # deterministic cohort -> JSONL + optional Postgres seed
npm run data:export         # labeled Postgres rows -> gitignored training JSONL
npm run model:train         # JSONL -> lib/model/model.json + docs/MODEL_CARD.md
npm run model:demo          # data:synthetic then model:train
npm run cache:seed -- --run-id <id>   # seed verification cache from a capture row
npm run cache:seed -- --plan-file <json>  # seed a planner cache from a saved run
npm run typecheck && npm test && npm run lint && npm run build   # full gate
```

Never foreground the dev server during automation: use a background log, probe with
`curl --max-time`, then stop it. Use `vitest run`. After a feature is complete, commit and push
to `origin`; never force-push. Live planning needs an authenticated OpenCode service; the app
discovers or starts the local one. Use `AGENT_MOCK=1` when no service or model should be called.
The synthetic and training CLIs read `DATABASE_URL` from the shell; load
`.env.development.local` before running them when you want a Postgres seed. On the production
host, build first, then `chown -R planmytrip:planmytrip .next` before restarting
`planmytrip.service`; the service user owns the image cache.

## 4. Environment

| Variable | Where used | When missing |
| --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Browser and server render | Required to sign in. The key is public by design. |
| `CLERK_SECRET_KEY` | Server only, Clerk middleware, route handlers, proxy | Required. Never expose it to client code, logs, or the repository. |
| `NEXT_PUBLIC_CLERK_PROXY_URL` | Browser and server render | Defaults to `/__clerk`. Production Clerk's domain `proxy_url` must use the same path. |
| `TINYFISH_API_KEY` | Server only, `app/api/travel-swarm/route.ts` | Each worker emits `worker_error` code `missing_api_key`; the stream still returns 200. Never log, echo, or commit it. |
| `TINYFISH_RECORDING` | Server only, swarm runner and archive | When `1`, asks TinyFish for a recording and archives it locally. Off otherwise; live checks are unaffected. |
| `PLANMYTRIP_RECORDINGS_DIR` | Server only, `lib/cache/recordings.ts` | Defaults to `$HOME/recordings` in production and `.next/cache/recordings` elsewhere. Must be writable by the app user. |
| `PLANMYTRIP_CACHE` | Server only, cache store | Set `0` to disable both cache tiers. Enabled by default when a database is configured. |
| `PLANMYTRIP_CACHE_MEMORY` | Server only, cache store | Force (`1`) or disable (`0`) the in-process tier. Production enables it automatically when `DATABASE_URL` is set; tests use `1` without a database. |
| `SWARM_MOCK` | Server only, swarm route | Only when `1` and `NODE_ENV !== "production"`; mock events carry `mock: true`. Ignored in production. |
| `SWARM_MOCK_SPEED` | Server only, mock timeline | Multiplies the scripted mock clock; tests use `50`. Ignored in production. |
| `SWARM_MOCK_FAIL` | Server only, mock timeline | One worker id that fails with `site_blocked`; used to exercise the error UI. Ignored in production. |
| `AGENT_MOCK` | Server only, planner route | Only when `1` and `NODE_ENV !== "production"`; every planner payload carries `mock: true`. Ignored in production. |
| `OPENCODE_SERVER_URL` | Server only, `lib/agent/agentClient.ts` | When empty, the app discovers or starts the local OpenCode service. |
| `OPENCODE_SERVER_USERNAME` / `OPENCODE_SERVER_PASSWORD` | Server only, explicit OpenCode server | Optional Basic auth for an explicit server. Never log or commit them. |
| `OPENCODE_MODEL` | Server only, planner sessions | Optional `provider/model`; when empty the service default is used. The default free model can hit a quota, so production should set a paid model. |
| `OPENCODE_MODEL_VARIANT` | Server only, planner sessions | Optional model variant passed with `OPENCODE_MODEL`. |
| `NOMINATIM_URL` | Server only, geocoder | Defaults to the public Nominatim endpoint; production should use a licensed endpoint. |
| `NOMINATIM_USER_AGENT` | Server only, geocoder | Defaults to `PlanMyTrip.health/0.1 (travel planning; contact@planmytrip.health)`. |
| `GEOCODER_FALLBACK_URL` | Server only, geocoder | Optional GeoJSON fallback used when Nominatim returns no point, and the default search endpoint for destination autocomplete. Production points at Photon; confirm its licence, quota, and attribution. |
| `GEOCODER_SEARCH_URL` | Server only, geocoder | Optional dedicated autocomplete endpoint. Defaults to `GEOCODER_FALLBACK_URL`; must return Photon-shaped GeoJSON. |
| `GEOCODER_REVERSE_URL` | Server only, geocoder | Optional reverse endpoint for current location and map pins. Defaults to the search endpoint's sibling `/reverse`; must return Photon-shaped GeoJSON. |
| `NEXT_PUBLIC_MAP_TILE_URL` | Browser, `components/TripMap.tsx` | Defaults to public OpenStreetMap tiles; production should use a licensed tile endpoint. |
| `NEXT_PUBLIC_MAP_ATTRIBUTION` | Browser, `components/TripMap.tsx` | Defaults to the OpenStreetMap attribution. |
| `DATABASE_URL` | Server only, `lib/db/postgres.ts` | Required for capture. The app returns 500 JSON for trip routes and capture stays best-effort until a database is configured. |
| `DATABASE_SSL` | Server only, Postgres pool | Set `true` only for a managed provider that requires TLS. Certificates are validated; use `NODE_EXTRA_CA_CERTS` for a private CA rather than disabling verification. |
| `PLANMYTRIP_CAPTURE_MOCK` | Server only, capture paths | Only when `1`; allows mock planner and swarm runs to be stored for tests. Never enable in production. |
| `NODE_ENV` | Next.js, mock guards | Next sets it; production disables both mock modes. |

`.env.example` is committed; `.env*` is ignored except it. Never read, print, or commit a real
`.env*` file. Local use: `cp .env.example .env.development.local`, set the Clerk pair,
`TINYFISH_API_KEY`, `DATABASE_URL`, and optionally `OPENCODE_MODEL`, then run
`npm run db:init` and `npm run dev`. The development-only filename keeps the production
`next start` from reading the local secret file. The OpenCode service must be installed and
authenticated for live planning; `AGENT_MOCK=1` needs neither a key nor a service. Production
keeps database, Clerk, and provider secrets in `/etc/planmytrip.env`; production also sets
`TINYFISH_RECORDING=1` and leaves the cache enabled. The production Clerk
application is `app_3MR7sJ2fhslkGXYl4yRqjseO13C`; its production domain uses the same-origin
Frontend API proxy at `https://planmytrip.health/__clerk`. Dashboard sign-in does not
authenticate the Clerk CLI; run `npx -y clerk@latest auth login` on the host before targeting
account-level CLI resources. See `docs/AUTH.md`.

## 5. Architecture

Every tracked source file, annotated; `package-lock.json` and generated files
(`next-env.d.ts`, `.next`, `tsconfig.tsbuildinfo`) are omitted by category.

```text
app/  globals.css, layout.tsx, page.tsx, model/page.tsx, sign-in/[[...sign-in]]/, sign-up/[[...sign-up]]/, trips/, trips/[id]/, mock-browser/[worker]/, api/travel-swarm/route.ts, api/agent-plan/route.ts, api/recordings/[id]/route.ts, api/geocode/search/route.ts, api/geocode/reverse/route.ts, api/saved-trips/route.ts, api/saved-trips/[id]/route.ts, api/trips/route.ts, api/trips/outcome/route.ts
lib/  engine: healthTripEngine.ts (entry), healthTripTypes.ts, types.ts, conditionProfiles.ts, sunLifeRules.ts, healthScore.ts, itineraryBuilder.ts
      swarm: swarmTypes.ts (wire contracts), swarmConfig.ts, swarmState.ts, swarmReducer.ts, swarmRunner.ts, swarmGoals.ts, swarmMock.ts, swarmTelemetry.ts, swarmErrors.ts, sse.ts, tinyfish.ts, tinyfishEvents.ts
      agent: agentTypes.ts (wire contracts), agentRequest.ts, agentProfiles.ts, agentPrompts.ts, agentConfig.ts, agentClient.ts, agentWarmup.ts, agentRunner.ts, agentSession.ts, agentParse.ts, agentPlanParse.ts, agentFallback.ts, agentGeocode.ts, agentEvents.ts, agentMock.ts, plannerReducer.ts, plannerStage.ts
      data: types.ts (versioned contract), dose.ts, tripDossier.ts, capture.ts, validation.ts, savedTrips.ts (account contract)
      db: postgres.ts (pg pool + schema), trips.ts (capture repository), savedTrips.ts (account repository)
      model: types.ts, math.ts, features.ts, logistic.ts, calibration.ts, train.ts, predict.ts, artifact.ts, model.json
      output: describeTrip.ts, pacingStrip.ts, careCard.ts, planMotion.ts
      verification: verificationOverlay.ts
      route: routeTypes.ts (wire contracts), geometry.ts, legs.ts, optimizer.ts, routeStops.ts, routeDay.ts, routePlan.ts, mapsLink.ts
      cache: cacheKey.ts (identities), cacheStore.ts (memory and Postgres), planCache.ts, swarmCache.ts, cachedEvents.ts, swarmArchive.ts, recordings.ts, tinyfishRuns.ts (run detail)
      geocode: types.ts (place contracts), search.ts (Photon/Nominatim search and reverse)
      mapTiles.ts (shared tile URL and attribution)
hooks/  useSwarm.ts, swarmStream.ts, swarmFrames.ts, swarmBatch.ts, useNow.ts, useElapsed.ts, useReducedMotion.ts, usePhaseAnnouncement.ts, usePlanMotion.ts, useAgentPlan.ts, plannerStream.ts, plannerFrames.ts
components/  Onboarding.tsx, LocationField.tsx, LocationPickerDialog.tsx, PlannerHome.tsx, PlanWorkspace.tsx, WorkspaceSection.tsx, SiteChrome.tsx, CommandBar.tsx, CommandDock.tsx, LiveRail.tsx, PlanPanel.tsx, DayFocus.tsx, SaveTripButton.tsx, SavedTripView.tsx, DeleteSavedTripButton.tsx, AgentTeamPanel.tsx, AgentRoster.tsx, AgentActivityFeed.tsx, AgentPlanView.tsx, AgentPlanDays.tsx, AgentPicks.tsx, RoutePanel.tsx, TripMap.tsx, ItineraryBoard.tsx, PacingStrip.tsx, VerificationAdjustments.tsx, TripOutcomePanel.tsx, WorkerFindings.tsx
components/mission/  MissionControl.tsx, StatusBar.tsx, FocusView.tsx, WorkerTile.tsx, ActivityFeed.tsx, TempoStrip.tsx, SourcesList.tsx, FindingsReveal.tsx, PreRun.tsx, ConnectionStatus.tsx, Elapsed.tsx, missionMeta.ts
components/ui/  index.ts, Button.tsx, Callout.tsx, Checkbox.tsx, DataRow.tsx, Disclosure.tsx, Field.tsx, LinkButton.tsx, Metric.tsx, NumberInput.tsx, SectionHeader.tsx, Select.tsx, Skeleton.tsx, Slider.tsx, StatusGlyph.tsx, TextInput.tsx, numberInput.ts (clampInteger), sliderFill.ts (sliderFillPercent), metricBars.ts (metricBarWidths)
public/pitch/  index.html, deck.css, deck.js, basil.jpg, fonts/
scripts/  db-init.ts, export-training.ts, synthetic.ts, train-model.ts, seed-cache.ts
data/  synthetic-trips.jsonl
docs/  ML.md, MODEL_CARD.md, PITCH.md, ROUTE.md, AUTH.md
tests/  contrast.test.ts, design-guard.test.ts, smoke.test.ts, instrumentation.test.ts, model-artifact.test.ts, data-loop.test.ts, swarm-route.test.ts, swarm-runner.test.ts, swarm-runner-isolation.test.ts, swarm-recovery.test.ts, swarm-retry.test.ts, agent-route.test.ts, agent-capture.test.ts, swarm-capture.test.ts, outcome-route.test.ts, cache-route.test.ts, geocode-route.test.ts, healthTripFixtures.ts, swarm-route-fixtures.ts, mocks/clerk-server.ts
module tests  lib/: onboarding.test.ts, careCard.test.ts, describeTrip.test.ts, healthTripEngine.test.ts, healthTripEngineRules.test.ts, pacingStrip.test.ts, planMotion.test.ts, savedTrips.test.ts, swarmGoals.test.ts, swarmMock.test.ts, swarmTypes.test.ts, swarmReducer.test.ts, swarmReducerResults.test.ts, swarmTelemetry.test.ts, swarmErrors.test.ts, verificationOverlay.test.ts, tinyfish.test.ts, tinyfishEvents.test.ts; lib/cache/: cacheKey.test.ts, planCache.test.ts, swarmCache.test.ts, cachedEvents.test.ts; lib/geocode/: types.test.ts, search.test.ts; lib/agent/: agentRequest.test.ts, agentWarmup.test.ts, agentParse.test.ts, agentPlanParse.test.ts, agentFallback.test.ts, agentEvents.test.ts, agentPrompts.test.ts, agentGeocode.test.ts, plannerReducer.test.ts, plannerStage.test.ts; lib/route/: geometry.test.ts, legs.test.ts, optimizer.test.ts, routePlan.test.ts, mapsLink.test.ts; lib/data/: dose.test.ts, tripDossier.test.ts; lib/db/: trips.test.ts, savedTrips.test.ts, tripCache.test.ts; lib/model/: artifact.test.ts, calibration.test.ts, logistic.test.ts, train.test.ts; components/ui/: sliderFill.test.ts, metricBars.test.ts, numberInput.test.ts; components/mission/: missionMeta.test.ts; hooks/: swarmFrames.test.ts, swarmBatch.test.ts, plannerFrames.test.ts
root  proxy.ts, package.json, tsconfig.json, next.config.ts, eslint.config.mjs, vitest.config.mts, instrumentation.ts, .env.example, .gitignore, README.md, AGENTS.md, BUILD_LOG.md
```

Data flow: `Onboarding` collects a `TripConfig`; the page normalizes it, increments
`deployNonce`, and reveals `PlanWorkspace`. The page memoizes `buildHealthTripPlan` and passes
the engine plan to the workspace. `PlanWorkspace` calls `useAgentPlan`, which POSTs
`/api/agent-plan`; `useSwarm` POSTs `/api/travel-swarm` with the same token. Planner
events flow through `plannerFrames`/`plannerReducer` into the command bar, seven-agent deck,
activity rail, route stage, and map; TinyFish events flow through
`useSwarm`/`swarmReducer` into live verification. The engine plan feeds the safety envelope
and supplies every concierge day with its step and walking ceiling. The engine and the safety
envelope render independently of both agent teams. The finished plan is also projected into a
travel route in `AgentPlanView`; the route is derived from the plan and never writes back.

The page also owns a random install id and a per-run id; both agent POSTs carry them. On
`plan_ready` the planner route rebuilds the engine plan server-side and writes a consented
dossier; on `swarm_done` the swarm route writes bounded findings. The finished plan posts one
explicit outcome. A missing outcome is excluded from training, never read as a negative.

`app/page.tsx` is account-only: it reads `auth()` and redirects a signed-out visitor to
`/sign-in`. The planner remains a client component under `PlannerHome`; the header carries
`Saved trips` and the Clerk `UserButton`. `/trips` lists account-owned snapshots and
`/trips/[id]` reopens one. The install id and the consented research capture remain anonymous
and are not linked to the Clerk account.

### Cached planner and verification

`lib/cache/` is a two-tier result cache in front of both agent teams. `cacheKey.ts` normalises
destination, condition, medication, preferences, budget, and transport into a canonical key;
`cacheStore.ts` keeps an in-process map over an idempotent `trip_cache` table. A planner read
tries the exact preference key, then the newest row for the same destination, days, and
condition and labels that related match in the interface. A verification read requires every
requested worker, so a single-worker retry can reuse a complete recorded set. Plans live 30
days and verification 14 days; a hit records its hit count without delaying the response.

`/api/agent-plan` checks the cache before it touches OpenCode. A hit emits the same planner
contract in one fast pass: `planner_started`, one `agent_result` per agent, `plan_ready` with
`cached`, `cachedAt`, and `cacheMatch`, then `planner_done`. `/api/travel-swarm` does the same
with `worker_status`, `worker_started`, recorded `worker_sources` and `worker_progress`,
`worker_complete`, then `swarm_done`. Cached frames are real recorded telemetry, never
invented progress; they carry `cached: true`, and the workspace shows a "Cached plan" or
"Cached verification" callout with the original date. Both routes add `X-Plan-Cache` or
`X-Swarm-Cache: hit|miss`.

A live miss writes the finished result after the terminal frame. When `TINYFISH_RECORDING=1`,
the swarm runner asks TinyFish for a recording; `tinyfishRuns.ts` reads the run-detail
`video_url`, `recordings.ts` archives the WebM under `PLANMYTRIP_RECORDINGS_DIR`, and
`/api/recordings/[id]` serves it only to a signed-in user. `FocusView` plays the recording
after the live frame ends. Cache keys exclude origin, run id, install id, and Clerk identity;
the cache writes no training label and never runs for mock data. `npm run cache:seed` can seed
a verification row from an existing capture or a planner row from a saved JSON file.

### Accounts and saved trips

Clerk is the identity source. No local password, OAuth token, or duplicate user profile is
stored. `proxy.ts` installs Clerk middleware and a same-origin Frontend API proxy; production
Clerk's domain `proxy_url` is `https://planmytrip.health/__clerk`. The proxy wrapper forwards
only Clerk's auth request headers, because Next 16.4.6 hangs on Clerk's full request-header
override set. The page and every protected API still perform their own `auth()` check; the
middleware is not the authorization boundary.

`GET/POST /api/saved-trips` and `GET/DELETE /api/saved-trips/[id]` are scoped by Clerk user id.
The `saved_trips` table stores one validated `TripConfig` and `AgentTripPlan` snapshot per
`(clerk_user_id, run_id)`, with a server-generated UUID and a summary destination, days, and
condition. Saving the same run updates the same row. Store and render paths both run
`normalizeWirePlan`; mock plans are never saved. The saved view rebuilds the deterministic
engine envelope from the saved trip, so the safety limits are current while the concierge plan,
places, and sources stay the captured snapshot. Live verification is not stored or rechecked
there. The anonymous `trip_captures` table is unchanged and never stores the Clerk user id.

The Clerk production keys live in `/etc/planmytrip.env`; never put the secret in a
`NEXT_PUBLIC_*` variable, a committed file, or a log. The production application is
`app_3MR7sJ2fhslkGXYl4yRqjseO13C`. The Dashboard selection does not authenticate the Clerk CLI;
use `npx -y clerk@latest auth login` on the host before account-level CLI commands. The
prebuilt form reads literal Paper and Ink values from `lib/clerkAppearance.ts`; Clerk does not
resolve `var(--token)` in its own color variables. Full schema, privacy, and rollout notes are
in `docs/AUTH.md`.

### Agentic concierge

`lib/agent/agentRunner.ts` owns the live run. It discovers or starts an OpenCode service via
`@opencode/client`, writes seven agent definitions into a temporary workspace, and runs six
research specialists in parallel: stay, table, trail, culture, transit, and care. Each is a
separate OpenCode session with its own system prompt, source rules, and JSON shape. The lead
concierge then receives the verified research plus the engine's day ceilings and returns one
sequenced plan. The workspace path includes the current OS user id
(`planmytrip-health-agent-workspace-<uid>`), so a root development run and the `planmytrip`
service never share a config file.

`instrumentation.ts` starts `lib/agent/agentWarmup.ts` once on the Node server, before the
first request. The warmup resolves the service connection, the temporary workspace, and all
seven agent definitions; the live run awaits that same memoized promise. A failed warmup is
not cached, so the next request retries. Startup never waits for it, never crashes the server,
and logs no credentials. Phase messages are emitted immediately, so the interface shows
"Preparing the agent runtime" and "Opening a specialist session" instead of silence.

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

Timeouts are 420s per specialist and 300s for the concierge; `/api/agent-plan` declares
`maxDuration = 900`. Specialists have 20 model steps and the concierge 12. The prompts reserve
the final steps for the JSON object so a step-limit stop cannot replace the deliverable with
prose. `OPENCODE_MODEL` selects a `provider/model` and is passed explicitly to every session so
a slow config reload cannot silently fall back to the free model. A provider quota failure
becomes `agent_unavailable`, not an invented plan. `AGENT_MOCK=1` scripts the same events and a
full sample plan with no service or network.

`geocodePlan` fills missing coordinates for up to ten selected places through Nominatim at one
request per second, with an identifying User-Agent; it never guesses a location and marks each
resolved place `geocoded: true`. The fallback map lists only verified or geocoded coordinates.

`TripMap` is a client-only Leaflet view with grayscale OSM tiles, category-shaped numbered
markers, a 44px hit area, one dashed route per day, a category legend, a collapsed numbered key,
and the required attribution. The Leaflet flag prefix is disabled. Tiles and geocoding are
production dependencies with licences to verify; see section 9.

The workspace is one page, not a tabbed report. A sticky `CommandBar` carries trip identity,
the mission stage with a four-step rail, both run clocks, agent/step/source/finding counts,
the newest activity line, the trip actions, and two real progress rules (planners and checks).
Below it a named-area CSS grid reflows through four stages: the planning deck leads while
sessions open (`forming`), the deck keeps the width while research lands (`researching`), the
deck stays open while the concierge composes (`composing`), and the finished stage leads while
the deck collapses (`ready`). Verification spans the full width at ready. Panels move by grid
area, never by unmounting, so both streams and all three preview frames continue while the
layout changes.

`WorkspaceSection` is the relevance layer. Each live surface opens only while it carries the
work: the planning deck while sessions run, verification while checks run, and the route stage
once checks settle. A settled surface collapses to one line with its real counts; the reader
can reopen any section. The body stays mounted and becomes inert while closed, so a collapse
never aborts a stream or unmounts a preview. `components/ui/Disclosure.tsx` supplies the
accessible button, the animated grid-row body, and the reduced-motion path. `lib/agent/plannerStage.ts`
derives the stage, the surface mode, the rail state, and the newest agent purely from the
planner state.

A fixed five-item `CommandDock` appears below 1024px and jumps to the route stage, deck,
verification, safety envelope, and activity rail. A running stream carries a live dot. Every
jump target has scroll margin for the fixed header and bar.

`DayFocus` is the map control: "All days" or one 44px day button, arrow, Home, and End keys,
and a focus strip with that day's estimate and ceiling, walking distance, recovery minutes, and
checkpoint. Selecting a day fits the map to its stops, dims the other markers, opens the
matching route and day-plan rows, and rules the matching envelope row. A `Map` action on a
route day and a "Show ... on the map" action in an open day scroll the map back into view.

The planning deck shows only agents that are still working, with phase, role, and newest line.
Completed and failed agents fold into one "Completed agents" disclosure. At ready the deck is
also collapsed by its section. The deck follows the agent with the newest activity line unless
the reader pins one, and the focused agent's history, result, or error opens below.

The activity rail switches between the planning signal and the verification feed. It follows
the stream with the newest real line, and verification once the plan is ready, unless the
reader pins one; `Follow live` restores auto-follow. Both feeds stay mounted. The planner
signal shows the newest two lines with an "Earlier updates" disclosure; the verification feed
shows the newest three with an "Earlier activity" archive. The verification section shows three
worker tiles, one mounted live frame per worker, and the focused worker's sources and findings
inside a disclosure. The safety envelope keeps every day's step and walking caps and the
over-cap caution visible; the focused day opens its pacing strip, block list, and checkpoint.

While the route is forming, `PlanPanel` holds the space with a designed route skeleton, seven
real phase ticks, and the trip's true day slots. `DayFocus` labels the focused day with the
agent estimate, modeled ceiling, recovery minutes, and the engine checkpoint; a day above its
ceiling shows a caution and the safety limit wins.

### Travel route and Maps handoff

`lib/route/` turns the finished plan into an ordered route. The transport question sits on
onboarding step 01 (`walk`, `transit`, `car`, or `mixed`) beside an optional free-text origin;
both travel in `PlannerRequest` and the planner prompt. The route is a pure projection computed
in `AgentPlanView` with `useMemo`, so it never changes the plan, the computed dose, or the
captured dossier.

Each day's place-bearing blocks become stops; a place needs both coordinates. Meals and stay
check-ins are pinned to their slots, and the day's own base is not repeated as a stop. The
remaining stops are ordered by nearest neighbour from the base, then 2-opt, then Or-opt, with
strict-improvement and deterministic tie-breaks (`lib/route/optimizer.ts`). Each leg resolves
to walk, transit, or car from the chosen transport; a demanding day (a hike, or 70% of its
walking ceiling) avoids walking above 0.6 km when the mode allows. Totals, over-cap cautions,
and adjacent demanding-day cautions come from the legs, never from the agent's step estimate.

`RoutePanel` builds one Google Maps URL per day (base to stops and back, at most nine
waypoints) plus an arrival link from the origin to the base coordinates. `travelmode` is the
day's dominant leg mode. Links open in a new tab and the copy says the stops are sent to
Google. `docs/ROUTE.md` records the algorithm, complexity, and limits.

### Data loop and calibration model

Capture is opt-in on the onboarding health step. `app/page.tsx` owns a random install id
(localStorage, never a cookie) and a per-run `runId`; both agent POSTs carry them.
`useAgentPlan`/`useSwarm` pass them through, and `parsePlannerRequest`/`isSwarmRequestBody`
validate them. The planner route rebuilds the engine plan server-side on `plan_ready` and
writes a `TripDossier`; the swarm route writes bounded findings on `swarm_done`. The finished
plan renders `TripOutcomePanel`, which posts one explicit outcome to `/api/trips/outcome`.
`GET /api/trips` lists only that install's trips; the install id is preferred in an
`X-Install-Id` header so it stays out of proxy logs, with the query parameter kept for
compatibility.

`lib/data/dose.ts` is the single dose model. It maps concierge block kinds to exertion, raises
hike exertion from verified distance, elevation, and difficulty, counts walking kinds only,
and uses the engine's `stepsPerExertionMinute` and `kmPerStep`. The concierge's `stepEstimate`
is shown as an agent estimate and is never a training label. `reconcileDayCaps` marks a day
over its ceiling when either the agent estimate or the computed block dose is over, so a
long block cannot hide behind a low self-report. An empty day is unsafe; a rest day with a
real recovery block may legitimately carry zero steps. The fallback route sizes its anchors
against the engine ceiling and reports the computed dose rather than an invented factor.

`lib/model/` is a calibration layer, not a new predictor. The engine's modeled risk becomes
the prior log-odds, the model learns the residual, and isotonic PAVA fixes the scale:

```text
offset = logit(clamp((100 - healthSafetyScore) / 100, 0.01, 0.99))
η      = offset + β0 + β1·peakExposure + β2·recoveryCoverage + β3·tripLength
p      = isotonic(σ(η))
```

`lib/model/logistic.ts` is dependency-free IRLS with Gaussian priors and a Laplace
covariance; `calibration.ts` owns PAVA and the metrics; `train.ts` groups folds by `userId`,
fits the scaler and coefficients inside each fold, and runs an inner grouped cross-validation
so the isotonic map for an outer fold never sees that fold's labels. The artifact records
`pipelineVersion`; `artifact.ts` rejects another pipeline, another engine version, a
zero-row file, or any malformed dimension, and falls back to the engine. `predict.ts`
returns the probability, a 90% interval, the sample size, and a tier. With zero labels
`β = 0`, so the model is exactly the engine.

Tiers are `engine` (fewer than 50 labels, zero rows, or a stale engine version), `synthetic`
(demo artifact, never live), `pooled` (at least 50 real labels), and `condition` (at least
200 labels for that condition). A synthetic artifact is visible on `/model` but cannot
change a live plan, and a static test proves no live API, capture, or planning module
imports it. When real data arrives, the learned model may only tighten a cap, never widen it
above the profile ceiling.

`lib/db/postgres.ts` owns a parameterized `pg` pool and the idempotent `trip_captures` and
`model_runs` schema; `npm run db:init` applies it. Production, development, and tests use
separate PostgreSQL databases through `DATABASE_URL`. Capture is best-effort but the planner
and swarm streams wait for their pending writes before closing. `scripts/synthetic.ts` writes
the JSONL cohort and marks every row `synthetic: true`; when `DATABASE_URL` is set it also
seeds the same dossiers into Postgres for inspection. `scripts/export-training.ts` writes
only explicitly labeled rows to the gitignored training JSONL and excludes mock plans, other
data schemas, and other engine versions. Both the CLI and `trainModel` refuse to label the
synthetic cohort `--source outcomes`. `scripts/train-model.ts --source outcomes` writes
`lib/model/model.json`, `docs/MODEL_CARD.md`, and a `model_runs` row. See `docs/ML.md` for
the full contract, schema, metrics, consent rules, and scale-up ladder.

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

### Onboarding and live workspace

`app/page.tsx` owns only three things: `view` (`onboarding` or `workspace`), `trip`
(`TripConfig | null`), and `deployNonce`. It memoizes `buildHealthTripPlan` from the current
trip. `Onboarding` owns its draft, two steps, `medicationTouched`, and validation. The page
renders both screens and hides the inactive one with `hidden`, so editing never discards a
running workspace. `onComplete` normalizes the draft, sets the trip, increments `deployNonce`,
and reveals the workspace; `onCancel` resets the draft and returns to the running workspace.
The workspace is keyed by `deployNonce`, so a new build or replan remounts it at the top and
aborts older streams.

`Onboarding` is one focused screen, not a rail. Step 01 collects destination (the only hard
gate), duration, budget, and optional preferences. Destination and the optional starting point
are both `LocationField` comboboxes: typing searches `/api/geocode/search` after a 220ms
debounce and offers at most six city or place rows. `Use current location` reads the browser
position through `/api/geocode/reverse`. Destination asks for the city label; starting point
asks for the exact place and enables high-accuracy positioning, so it is as specific as a map
pin. `Pick on map` opens `LocationPickerDialog`, a mounted-only modal Leaflet map that places a
pin, reverse-geocodes the exact point, and fills the field only after a place is named.
Suggestions, current location, and the map all write a canonical label into the controlled
text, and the map picker returns focus to its field. Duration is a bounded integer field
(2-20 days), not a slider. Budget is a three-stop slider over Value, Balanced, and Premium.
Step 02 collects condition, medication (name only), Sun Life coverage, the anonymous capture
opt-in, the live coverage alert, and a review sentence.
The left column explains the three jobs; the right column is a 420px form on desktop and stacks
below at 1024. There is no deploy action before the form is complete. The draft helpers live in
`lib/onboarding.ts` and are pure-tested.

`PlanWorkspace` is the one-page result screen: trip summary with Edit trip and Plan again, the
live `MissionBand`, the sectioned route, safety envelope, and verification. `MissionBand` shows
the current stage, a counting elapsed timer, completed agents, a progress bar, and a four-step
rail with calm failure copy. `AgentTeamPanel` holds the seven-agent deck and the planning signal
graph; `AgentRoster` shows each agent's phase, role, and newest message or activity line, and
`AgentActivityFeed` turns the bounded log into a bar graph plus a five-line ticker. `PlanPanel`
shows the finished concierge plan, a designed route-forming skeleton with an animated dashed
route, or a calm retry. The safety envelope carries `CareCardButton` and `ItineraryBoard`; live
verification carries `MissionControl`. Everything is mounted for the whole page, so neither
stream aborts while the reader scrolls. `TripMap` receives `visible` and calls `invalidateSize`
when the page returns; a hidden page-level workspace also passes `visible=false`.

The page uses staggered section, deck, activity, signal, and marker motion. Every effect is
decorative and every animation is disabled under reduced motion. No phase renders the word
"Queued": the internal queued token reads as Starting for planner agents and Preparing for
TinyFish workers. The sister link is in the header from 640px and in the footer below. Gutters
are 24/40px; the footer sits 64px/96px below. The onboarding split is `1fr / 420px` with 80px
gap at 1024+; the workspace summary wraps its actions below the trip sentence. The page fits
375px without horizontal scroll, and controls stay at least 44px tall.

### Live verification mission control

`PlanWorkspace` owns `useSwarm` and passes `state`, `runInput`, `retry`, and `rerun` to
`MissionControl`. The mission control is one mounted surface: a sticky status bar, the
pre-run instruction rows, three worker tiles, one hero live view per worker, the activity
feed, the source ledger, and findings. Nothing is conditionally unmounted while a run is
live, so all three hidden preview iframes keep their streams.

The status bar is 48px and sticky inside the verification section. It reads the running
count, elapsed time, and `steps, sources, findings`; a finished run reads "Verification
complete" with a Re-run action. Its visually hidden `aria-live="polite"` line announces only
started, finished, and failed phase changes, at most once every three seconds.
`components/mission/Elapsed.tsx` owns the clock and is the only component that re-renders on
it. The browser title is `(n running) PlanMyTrip.health` while live,
`Verified n/3 - PlanMyTrip.health` when settled, and the plain title otherwise.

Worker tiles are a `role="tablist"` with arrow, Home, and End keys and a 2px ink top rule on
the selected tile. Focus follows the worker with the newest progress unless the reader pins a
tile; the line reads "Following activity" or "Pinned to <name>" with an Unpin action. The
focused `FocusView` is a 16:10 surface frame with a 32px chrome bar: phase glyph, worker,
preview host, a pulsing LIVE marker, elapsed time, `step n of 150 max`, and an Expand action
using the Fullscreen API. Beneath it the "Now" line crossfades on a real purpose change and
the tempo strip draws five-second buckets from accepted steps. Completion shows "Run complete"
for one second, auto-follows the next active worker, and replaces the iframe with a static
"Stream ended" frame after 1.5s.

`ActivityFeed` is a 320px internal scroller with All, Advisory, Pharmacy, and Coverage filters.
Lines carry `+MM:SS`, a worker tag, and the real purpose. The newest line types at about 40
characters per second only when fewer than three lines arrived together; older lines settle to
muted after two seconds. The feed auto-scrolls only while the reader is at the bottom, then
offers "Jump to latest (n)". Heartbeats never become lines; the merged feed is capped at 300.
`SourcesList` grows from `worker_sources` and search/fetch steps, deduplicates by URL or title,
and links each row with `noopener noreferrer`. `FindingsReveal` shows typed DataRow lists only
after COMPLETE, with a 60ms row stagger, provenance, retrieved time, and the raw JSON toggle.
`lib/swarmErrors.ts` maps every error code to calm copy and a retryable flag.

`PreRun` lists the three target hosts, what each will check, and a disclosure with the exact
goal string. `MissionControl` also shows the mock caution, a stale-inputs caution with Re-run,
and a dimmed findings state. Every visible change is backed by an accepted event; there are no
percentages, ETAs, or partial findings.

Worker state machine (pure `lib/swarmReducer.ts`):

```text
idle --run_started--> queued --worker_status(running) or worker_started--> running
queued/running --worker_complete--> complete
queued/running --worker_error or stream_failed--> error
complete/error --run_started (same worker)--> queued
```

Each worker keeps `runId`, start and end times, the current purpose, up to 200 steps, a
step count, heartbeat count and last time, up to 100 deduplicated sources, up to 20 notes,
a retry count, and the last accepted sequence. Duplicate or out-of-order `seq` values are
ignored. `lib/swarmTelemetry.ts` derives elapsed time, five-second tempo buckets, connection
health (`live`, `quiet` after 12s, `stalled` after 30s), the bounded merged feed, a summary
(running, steps, sources, findings), merged source rows, and staleness. `hooks/useSwarm.ts`
batches stream actions through `hooks/swarmBatch.ts` so a burst causes one reducer pass per
animation frame. `hooks/useNow.ts` ticks once a second only while a worker is queued or
running; idle pages have no clock.

Worker events are accepted only from queued or running; `run_started` is the only exit from
idle. Progress keeps the last three purposes. `streaming_url` accepts only https on
`mock.invalid`, `*.unikraft.app`, or `*.tinyfish.io` (VERIFY) in `lib/swarmState.ts` and
`hooks/swarmFrames.ts`, plus the dev-only same-origin `/mock-browser/<worker>` path; all other
hosts are rejected. A live worker has a 280s client budget inside a 300s route. TinyFish caps
each browser run at 100s or its default step ceiling, but queue delay and recording
finalization can push the wall clock near three minutes. If the SSE stream ends before
COMPLETE, the runner polls `GET /v1/runs/{id}` and uses the authoritative run record. A
transient failure retries once, a worker failure never aborts its siblings, and
`/api/travel-swarm` declares `maxDuration = 300`. `swarm_done` stores completed and failed
lists. Any `mock: true` payload shows the "Mock data" caution Callout; a full run clears it.

The frame sets `referrerPolicy="no-referrer"` and
`sandbox="allow-scripts allow-same-origin"`. Preparing shows a static explanation, never a
skeleton of fake activity. A completed worker's iframe stays mounted for 1.5 seconds after its
last event, then unmounts; none of the three hidden frames is recreated by switching tiles.

### Verification overlay

`lib/verificationOverlay.ts` is pure. `applyVerification(plan, {condition}, findings, options)`
returns a new plan and typed adjustments. It only tightens: an advisory heat, air-quality,
altitude, outbreak, or allergen match appends a bounded verified note to affected day
checkpoints, and a heat or air-quality match on a sensitive condition extends that day's
recovery block by 30 minutes, at most once per day. A coverage pre-authorization string becomes
a display-only checklist adjustment. Step and walking ceilings, scores, and the Sun Life alert
never change. Unmatched, null, or "Not found" findings produce no adjustment; a master switch
and per-adjustment ids control what applies. Ids, order, and reason text are deterministic, and
reapplying the result is a no-op.

### KPI strip and paced itinerary

`ItineraryBoard` derives everything from `plan`; agent results never feed it directly, except
through the typed verification overlay. The KPI strip shows Health Safety Score (`/100`,
baseline compare bars), Daily Step Ceiling (`steps`), and Flare / ER Risk Reduction (`%`), both
modeled figures with a "Modeled estimate" sub-line and an input tooltip. It is three-up from
768px and stacks below that width. A border-topped line reads
`Live verification: n of 3 sources checked` and updates as workers return findings. KPI numbers
tween over 300ms with `lib/planMotion.ts`; a changed value shows a hairline diff block such as
`Step ceiling 6,000 to 5,000 steps` for four seconds. `hooks/usePlanMotion.ts` owns the tween
and the four-second diff lifetime; reduced motion returns the final value immediately.

Each day is a hairline row, not a card: a 64px day number using `.t-metric-day`, title, pacing
rule, strip, block list, and accent-soft checkpoint. A 160px column carries step and walk caps
as stacked DataRows (one-decimal km); mobile shows two columns. `.day-row` applies the global
240ms rise and 40ms stagger; reduced motion disables both. A day with an applied recovery
adjustment gets `.anim-arrive`, an "Adjusted by verification" t-label, the
`Afternoon recovery 30 to 60 min` diff line, and the source link and retrieved time. The inline
SVG strip in `components/PacingStrip.tsx` has a 64px plot, an HTML 16px axis, ink bars at
`exertion / 3`, a hatched 12px recovery bar, and two-hour labels from 08:00. Exertion bars use
`transform: scaleY` from the bottom; recovery bars use `scaleX`; both transition over
`--dur-base` and stop under reduced motion. The block list is its text equivalent.

`CareCardButton` is the SectionHeader action. `buildCareCard` is pure and deterministic:
title, trip facts, blank line, Sun Life alert, blank line, `Daily checkpoints`, one
`Day <n> (step cap <n> steps): <checkpoint>` line per day, an optional
`Applied verification adjustments` section with each applied adjustment's source URL and
retrieved time, blank line, planning notice (exact text in `lib/careCard.ts`). With no days it
prints `No itinerary days are available.` Copy uses `navigator.clipboard.writeText` with a
two-second "Copied" label and a live status announcement; on failure a read-only textarea shows
the text. That fallback is the only raw control outside `components/ui` and carries a
`design-guard-ignore` comment.

`VerificationAdjustments` sits under the safety SectionHeader when findings exist. It carries
the master "Apply live adjustments" Checkbox and one Checkbox per checkpoint, recovery-day, or
checklist adjustment, with reason, worker, source link, and retrieved time. Turning the master
off restores the engine plan exactly.

### Pitch deck

`public/pitch/` is a static 1920×1080 Paper and Ink deck served at `/pitch` by a rewrite in
`next.config.ts`. It is presentation-only: not an app route, not covered by the design guard,
and it adds no application code. It has ten slides (eight presented, two appendix), local
woff2 fonts under `public/pitch/fonts`, inline SVG diagrams, and one raster asset, `basil.jpg`,
a personal photograph used with the family's consent. The appendix carries the calibration model
and the data asset; the presented path stays at eight slides. Arrow keys advance,
`F` toggles fullscreen, `Home` / `End` jump, and the page prints to PDF. `docs/PITCH.md` holds
the three-minute script, demo runbook, sources, and rubric check. Edit the deck as HTML, CSS,
and vanilla JavaScript; do not rebuild it in React.

## 6. Key decisions

- **Stack:** Next.js 16.4.6, React 19.3.0, Tailwind 4.3.3, strict TypeScript, Vitest
  4.1.12. Tailwind v4 uses `@theme inline`; there is no `tailwind.config`, and the generated
  Turbopack CSS rule stays in `next.config.ts`. Fonts are local Fontsource families, not
  `next/font/google`, so builds need no network.
- **Vitest 4, not 5:** the scaffold pins `@types/node@^20`; Vitest 5 needs `>=22`, and Vitest
  4 avoids `--legacy-peer-deps`.
- **Baseline security headers:** `next.config.ts` sends `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Frame-Options: SAMEORIGIN` on every
  route. SAMEORIGIN keeps the dev-only mock-browser frame embeddable while blocking every
  cross-origin embed; the remote TinyFish previews are iframes inside this page and are
  unaffected.
- **Clerk owns identity:** `@clerk/nextjs` 7.10.7 provides required sign-in at `/sign-in` and
  `/sign-up`. The live application is `app_3MR7sJ2fhslkGXYl4yRqjseO13C`. Pages and protected
  APIs call `auth()` themselves. The production domain uses Clerk's same-origin Frontend API
  proxy at `/__clerk`, so no separate `clerk.planmytrip.health` browser origin is required.
  `proxy.ts` forwards only Clerk's auth request headers; Next 16.4.6 hangs if Clerk's full
  request-header override set is passed through. Do not drop that filter without a build and
  live request check.
- **Saved trips are account-owned, captures are anonymous:** `saved_trips` is scoped by
  `clerk_user_id` and stores a validated trip and plan snapshot. `trip_captures` remains
  consent-gated, keyed by the random install id, and never stores the Clerk user id. Deleting a
  saved trip never deletes a research capture.
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
- **Location is a label, not a new trip field:** autocomplete, current location, and the map
  picker all resolve to a bounded destination string. No coordinate, permission state, or
  geolocation trace is added to `TripConfig`, the capture dossier, or the cache key. The map
  pin is a UI aid; the itinerary still derives place coordinates from verified research.
- **PostgreSQL, not SQLite:** `pg` with a parameterized pool is the capture, saved-trip, and
  model-run store. `saved_trips` carries the account-owned snapshot; `trip_captures` and
  `model_runs` carry the anonymous research loop. The schema is idempotent and applied by
  `npm run db:init`; production, development, and tests use separate databases. No SQLite file
  or binary demo database is committed. Database writes are awaited before the SSE stream
  closes.
- **Computed dose, not self-report:** the concierge's `stepEstimate` is an agent claim. Every
  training row is computed from block kind, duration, exertion, and verified hike elevation,
  so live and fallback plans yield comparable doses. A displayed day is inside its cap only
  when the agent estimate and the computed dose both fit; an empty day is unsafe, not zero.
- **Cache results, not progress:** a cached destination replays completed planner and
  verification results in about a second. Frames keep the real event contract and carry
  `cached: true`; no percentage, ETA, or fake step is added. A planner cache key includes the
  preference set, with a clearly labelled destination + days + condition + medication fallback. A
  verification key requires all requested workers. Mock data is never cached, cache writes
  never block a live result, and the cached plan is a snapshot, not a live recheck.
- **Recordings are evidence, not a preview:** when recording is enabled, the archive stores
  the real TinyFish run video locally and serves it only to signed-in users. The live preview
  URL still expires and is never replayed from cache.
- **Calibration, not a new predictor:** the engine's modeled risk is the prior log-odds; the
  model learns the residual. A zero-coefficient artifact is exactly the engine, and a
  synthetic artifact can never drive a live plan.
- **Nested calibration, not in-sample:** feature scaling and coefficients are fitted inside
  each fold, and an inner grouped cross-validation fits the isotonic map before it scores an
  outer fold. The reported Brier, log loss, and ECE are honest out-of-fold estimates.
- **Mock data never trains:** the synthetic cohort carries `synthetic: true`; the training
  CLI and `trainModel` refuse it under `--source outcomes`; export skips mock plans, other
  data schemas, and other engine versions. Install-scoped conflicts stop another browser
  from overwriting a dossier or its findings.
- **Consent before data:** capture is opt-in on the health step; the only id is a random
  localStorage install id; the flare answer is explicit rather than a default checkbox; the
  public outcome route stores no free text; an unanswered follow-up is not a negative label.
  A signed-in saved trip is separate product data and never adds the Clerk user id to a
  training row.
- **Scripts with `tsx`:** `tsx` is a dev dependency for the synthetic and training CLIs. It
  resolves TypeScript and path aliases without a build step.
- **Primitive-only UI:** compose `components/ui`; raw form controls live only there. Button
  `lg` (48px) exists for the onboarding primary action and the workspace build action.
- **Two screens, one session:** onboarding and workspace are view states, not routes, so a
  running plan survives Edit trip and Back to plan. The workspace is keyed by `deployNonce` to
  reset the page and streams on a new build.
- **One page keeps streams alive:** every live surface is mounted for the whole workspace.
  Do not bring back conditional tab panels or unmount verification while the plan forms.
- **Collapse by relevance, never by unmount:** `WorkspaceSection` opens the surface carrying
  the live work and collapses settled surfaces to a real summary. A reader can reopen any
  section. Closed bodies stay mounted and inert, so a collapse never aborts a stream. The
  activity feeds show only the newest lines; history is one disclosure away.
- **Route is derived, not re-planned:** `lib/route/` projects the finished plan into an order
  and a Maps link. It may reorder stops inside a day and pin meals, but it never moves a place
  to another day, so the plan, the dose, and the dossier stay identical. Transport changes
  movement and time, never a condition ceiling. Cross-day rebalancing needs its own
  capture-aware step.
- **Recover the run, not the stream:** an SSE disconnect is not a failed browser run. TinyFish
  keeps the run and exposes `/v1/runs/{id}`, so the worker polls that record and emits the real
  completion. Transient errors retry once, and each worker owns its own timeout so one failure
  never cancels the other two. The 280s worker budget covers provider queue delay and the
  100s browser cap inside a 300s route.
- **Warm at server start:** `instrumentation.ts` starts the memoized OpenCode runtime warmup so
  the first trip does not pay service, workspace, and agent-registration latency. A failed
  warmup is never cached and never blocks readiness.
- **No queued copy:** the internal `queued` phase is rendered as Starting or Preparing. Every
  agent always shows a phase and a newest activity line; silence is a bug.
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
Focus is a 2px accent outline.

Motion uses three tokens, `--ease` (cubic-bezier(0.2, 0.8, 0.2, 1)), `--dur-fast` (150ms),
`--dur-base` (240ms), and `--dur-slow` (400ms), and only the named classes below. Under
`prefers-reduced-motion` every class is instant; arrival surfaces also show a static `New`
t-label for four seconds so the information is not lost.

| Class | Role |
| --- | --- |
| `.anim-fade` | Opacity only, fast. A changed line or a "Now" purpose. |
| `.anim-rise` | 8px rise plus fade, base. A newly mounted row or panel. |
| `.anim-arrive` | Accent-soft wash fading over 1200ms. A source or finding that just arrived. |
| `.anim-tick` | Short opacity pulse. One real heartbeat. |
| `.anim-pulse-dot` | Slow scale and opacity loop. A running indicator only. |
| `.anim-collapse` | Height and opacity, slow. A panel that is leaving. |

Banned: gradients, blur, glow, shadows, emoji, flags, stock imagery, illustrations, purple,
centered heroes, feature-card grids, pill badges, marketing words (unlock, supercharge,
seamless, revolutionize, welcome to), lorem ipsum, default Tailwind palette colors, default
Tailwind text sizes, raw hex in components, Tailwind `animate-spin|ping|pulse|bounce`, and
`transition-all`.

### Accessibility and copy

WCAG AA contrast. Every control is keyboard reachable and labelled; tap targets at least 44px.
No text under 13px except 11px mono labels. Every async surface has designed empty, loading,
error, and success states. The workspace is one page; headings, the mission progressbar, the
elapsed timer, and polite live status text carry the live state. Controls stay keyboard
reachable with 44px targets. Copy is calm, specific, sentence case, without exclamation marks
or emoji; sentences stay under 20 words. Numbers carry units. `healthSafetyScore` and
`riskReductionPct` are always labelled "Modeled estimate" with a tooltip listing inputs.

### Guard tests

`tests/design-guard.test.ts` scans `app/**/*.{ts,tsx,css}` (except `app/globals.css`) and
`components/**/*.tsx`. It fails with `file:line` on default palette variants, raw white/black,
hex/rgb/hsl and arbitrary colors, default and arbitrary text sizes, unapproved weights, shadows
except `shadow-none`, gradients and blur, radii outside `none`/`frame`/`control`, pill radii
outside `components/ui`, raw form controls outside `components/ui`, Tailwind
`animate-spin|ping|pulse|bounce`, `transition-all`, emoji, flags, images, and banned marketing
copy. A separate motion guard requires all six named motion classes and a reduced-motion block
that switches them off. `design-guard-ignore` exempts a line. Twenty-two banned and four
allowed fixtures prove the rules. `tests/contrast.test.ts` checks 13 pairs at 4.5:1 or better.

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
- The calibration model is a planning-aid estimate. Show "Modeled estimate" until a
  real-data artifact reaches the pooled tier; never present synthetic output as clinical
  evidence. The model may only tighten a cap, never widen it above the profile ceiling.
- Never suggest doses or medication changes. Medication information is limited to generic
  and brand names, customs, and carry rules. The concierge prompts forbid telling the traveler
  to take or use a medication; copy refers to the clinician's plan.
- The concierge is a planning aid. Every day carries the engine's step and walking ceiling,
  recovery minutes, and checkpoint. Agent estimates are labelled as estimates; a day above a
  ceiling, including a day whose block dose exceeds the ceiling while its estimate does not,
  shows a caution and the Pacing limit always wins.
- The post-trip label requires an explicit flare answer; an untouched control is never saved
  as a negative. The public outcome route ignores free text. The research capture is keyed by
  the anonymous install id; Clerk account identity is stored only on saved trips.
- Agent findings show the source URL and retrieved time. Missing fields show "Not found",
  never a guess. Malformed JSON shows the raw text plus a parse error.
- Geocoded coordinates are labelled approximate. A place without a verified or geocoded
  coordinate is not plotted; the itinerary list remains the source of truth.

## 9. VERIFY register

Regenerate with `grep -rn "VERIFY:" app lib components`; there are 25 entries.

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
| `lib/swarmConfig.ts` (limits) | Custom `max_steps` is beta-gated on this account and returns 403 FORBIDDEN, so it must stay omitted. Confirm `max_duration_seconds: 100` and `cursor_style: "standard"` are accepted and one worker fits the 280s client/300s route budget after queue delay; the provider default is 150 steps. |
| `lib/swarmRunner.ts` (stealth retry) | Confirm a `SITE_BLOCKED` retry with `browser_profile: "stealth"` is accepted, does not double-bill, and does not repeat a side effect. |
| `lib/tinyfishEvents.ts` (TF_API_RESULT) | The provider documents an array but not its item shape. This build reads only direct string `url` and `title`; confirm the real shape on a live run before widening it. |
| `components/mission/FocusView.tsx` (iframe multi-viewer) | Confirm three distinct TinyFish previews can be embedded at once with two hidden but mounted. A concurrent-viewer limit would require pausing hidden frames. |
| `lib/verificationOverlay.ts` (keyword rules) | Heat, air-quality, altitude, outbreak, and allergen keywords are product heuristics, not clinical thresholds. Have a clinician confirm the mapping and the 30-minute recovery extension. |
| `lib/agent/agentGeocode.ts` (Nominatim) | Public Nominatim allows one request per second and requires an identifying User-Agent. Confirm the production geocoder's licence, quota, and attribution. |
| `lib/agent/agentGeocode.ts` (fallback) | The optional fallback uses Photon's public demo API in production today. Confirm its licence, quota, attribution, and data-retention terms, or point `GEOCODER_FALLBACK_URL` at a licensed GeoJSON provider. |
| `lib/geocode/search.ts` (autocomplete) | The onboarding search and reverse routes use the same Photon endpoints. Confirm the search quota, attribution, cache policy, and the permission copy for current location before a paid launch. |
| `lib/mapTiles.ts` (tiles) | Confirm the production tile licence, attribution text, and request volume for both the route map and the location picker. Public OSM tiles are not a high-volume production endpoint. |
| `lib/data/dose.ts` (block exertion) | The block-kind to exertion mapping and hike thresholds (8 km, 350 m, hard/strenuous) are product assumptions, not clinical thresholds. Have a clinician confirm the walking contribution of visits, transit, and care blocks. |
| `lib/data/dose.ts` (recovery) | Recovery coverage counts only `rest` blocks. Confirm that meals, stay, and unplanned pauses should not count as recovery. |
| `lib/route/legs.ts` (speeds) | 4.5 km/h walking, 18 km/h urban transit, 32 km/h driving, and the access and parking overheads are product assumptions. Confirm them for the destinations this product serves. |
| `lib/route/mapsLink.ts` (Maps URLs) | Nine waypoints and the `walking`/`transit`/`driving` values against Google's Maps URLs reference; confirm the terms permit this deep-link handoff. |
| `lib/cache/recordings.ts` (archive) | TinyFish recordings are WebM today. Confirm the codec, typical size, provider retention, and that local archival and authenticated replay are permitted. |
| `lib/tinyfishRuns.ts` (video_url) | The run-detail `video_url` is a presigned recording. Confirm its lifetime and the provider's permission to archive a copy locally. |
| `lib/model/model.json` (artifact) | The committed artifact is trained on synthetic trips. Never use it for a live plan. Replace it only with an artifact whose `source` is `outcomes` and whose tier is `pooled` or `condition`. |
| `docs/MODEL_CARD.md` (metrics) | Regenerate after every training run; confirm Brier, ECE, AUROC, and the calibration slope match `lib/model/model.json`. |

## 10. External integrations

Clerk: the app uses `@clerk/nextjs` 7.10.7 against production application
`app_3MR7sJ2fhslkGXYl4yRqjseO13C`. `ClerkProvider` sits inside `<body>`; required sign-in uses
`/sign-in` and `/sign-up` with relative redirects, so the public host survives nginx. The
production domain `planmytrip.health` is configured with `proxy_url:
https://planmytrip.health/__clerk`; `clerkMiddleware` handles the Frontend API proxy.
`proxy.ts` wraps the middleware and forwards only `x-clerk-*` request headers. Next 16.4.6
hangs when Clerk's full request-header override set (including `host` and `connection`) is
returned; the filter is load-bearing. Clerk's Dashboard sign-in is not CLI authentication;
run `npx -y clerk@latest auth login` on the host before changing account-level settings.

The nginx snippet `planmytrip-proxy.conf` sets `proxy_buffer_size 64k`, `proxy_buffers 8 32k`,
and `proxy_busy_buffers_size 64k` while keeping `proxy_buffering off` for SSE. Clerk's sign-in
handshake returns headers larger than nginx's 4k default; without the larger header buffer a
signed-in refresh ends in a 502 "upstream sent too big header". The nginx site sends
`Permissions-Policy: camera=(), microphone=(), geolocation=(self)`; `geolocation=(self)` is
load-bearing for the current-location control, while camera and microphone stay blocked.

OpenCode service: the server uses `@opencode/client` v2.3.2, discovers or starts the local
service with `Service.ensure()`, and writes seven `agents` entries into
`$TMPDIR/planmytrip-health-agent-workspace-<uid>/.opencode/opencode.json`. Each agent is `mode:
primary`, has a static system prompt and `steps`, and may use only `websearch` and `webfetch`.
`OPENCODE_MODEL` is passed both in the config and explicitly to `session.create`. The service
owns provider credentials; the app never reads, logs, or stores them. OpenCode Go auth is
installed in the service credential store or supplied to the service process as
`OPENCODE_API_KEY`; never put that key in the app's `.env*` files or the repository.

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
When Nominatim returns no point and `GEOCODER_FALLBACK_URL` is set, it asks that GeoJSON
endpoint once per query and accepts the result only when the city matches the destination. A
failed lookup leaves `lat` and `lng` null. Map tiles come from `NEXT_PUBLIC_MAP_TILE_URL`
with `NEXT_PUBLIC_MAP_ATTRIBUTION`; the Leaflet attribution prefix is disabled.

`/api/geocode/search` and `/api/geocode/reverse` are the onboarding sibling of that geocoder.
Both require Clerk auth, validate their query or coordinate bounds, and cache results in
process for ten minutes (search) or one hour (reverse). Search prefers
`GEOCODER_SEARCH_URL` / `GEOCODER_FALLBACK_URL` and otherwise uses Nominatim; reverse uses
`GEOCODER_REVERSE_URL`, the search endpoint's sibling `/reverse`, or Nominatim reverse. Only
the query or coordinate leaves the server; no account id, health value, or cookie is forwarded.
Provider failures become empty results or calm 502 copy, never a raw upstream body.

TinyFish Web Agent API: `POST https://agent.tinyfish.ai/v1/automation/run-sse` with
`X-API-Key` and JSON `{url, goal, output_schema?, browser_profile?, agent_config?}`. The key is
read only in the route; never log or echo it. `output_schema` is a top-level object using
`nullable: true`, never type arrays, `oneOf`, `const`, or `additionalProperties`. Every worker
sends `agent_config` with `cursor_style: "standard"` and `max_duration_seconds: 100`. Custom
`max_steps` is deliberately omitted because the account is not enabled for it; the provider
default is 150 steps. The limits live in `lib/swarmConfig.ts` and keep one worker inside the
280s client budget and 300s route. When `TINYFISH_RECORDING=1`, the request also carries
`capture_config: { recording: true }`; after completion, `GET /v1/runs/{id}` supplies the
presigned `video_url` that `lib/tinyfishRuns.ts` reads and `lib/cache/recordings.ts` archives.

Upstream `data: <json>` events: `STARTED` (run_id), `STREAMING_URL`, `PROGRESS`
(purpose, optional tinyfish_api), `HEARTBEAT`, `COMPLETE` (status/result/error), and optional
`TF_API_RESULT` (tinyfish_api, result array). Unknown types are counted and ignored;
`COMPLETE.result` is authoritative. The route forwards absolute http(s) STREAMING_URL values;
the browser keeps only https `mock.invalid`, `*.unikraft.app`, or `*.tinyfish.io` previews, plus
the dev-only same-origin `/mock-browser/<worker>` path. On HTTP 400 `INVALID_INPUT` the worker
retries once without `output_schema`; on `SITE_BLOCKED` it retries once with
`browser_profile: "stealth"`. Each retry emits a `worker_note` with calm copy.

TinyFish swarm frames all carry `worker`, a monotonic per-worker `seq`, an ISO `ts`, and
optional `mock`; `swarm_done` uses `worker: "swarm"` with its own sequence and is always last on
a connected stream. Planner frames use `agentId` and their own `planner_done` terminal frame
instead.

| Event | Fields | When |
| --- | --- | --- |
| `worker_status` | `status` (queued/running) | Before a run. |
| `worker_started` | `runId`, `startedAt` | TinyFish STARTED. |
| `streaming_url` | `streamingUrl` | A usable STREAMING_URL arrives. |
| `worker_progress` | `purpose`, `tinyfishApi?` | TinyFish PROGRESS. |
| `worker_sources` | `items: [{url?, title?, api}]` | TF_API_RESULT; only string url/title fields are read. |
| `worker_heartbeat` | none beyond the envelope | TinyFish HEARTBEAT; never a feed line. |
| `worker_note` | `message` | A bounded retry or lifecycle note. |
| `worker_complete` | `findings`, `sourceUrl`, `retrievedAt`, `rawResult?`, `parseError?` | COMPLETED. Malformed JSON keeps raw text and parse error. |
| `worker_error` | `code`, `message` | Missing key, timeout, blocked site, step limit, rate limit, credits, invalid input, forbidden account, cancelled, upstream error. |
| `swarm_done` | `completed`, `failed`, `summary` | Once after all requested workers settle. |

Headers are `text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`, and
`X-Accel-Buffering: no`; a keep-alive comment goes out about every 15s. Disconnect aborts
upstreams. Error codes: `missing_api_key`, `timeout`, `site_blocked`, `max_steps_exceeded`,
`rate_limit`, `insufficient_credits`, `invalid_input`, `forbidden`, `cancelled`, `upstream_error`; invalid
bodies 400 JSON. `/api/travel-swarm` declares `maxDuration = 300`. A stream that ends before
`COMPLETE` is reconciled through `GET /v1/runs/{id}`; transient failures retry once, and one
worker's failure never aborts its siblings.

Mock mode needs no key or network; every payload carries `mock: true`, preview URLs use the
dev-only `/mock-browser/<worker>` page, and the timeline is seeded. `SWARM_MOCK_SPEED`
multiplies the scripted clock (tests use 50); `SWARM_MOCK_FAIL=<worker>` makes that worker fail
with `site_blocked`:

```bash
SWARM_MOCK=1 SWARM_MOCK_SPEED=50 npm run dev
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

`npm test` runs Vitest once in a Node environment. The suite has 597 tests. Database-backed
files skip when `DATABASE_URL` is absent. `tests/mocks/clerk-server.ts` replaces
`@clerk/nextjs/server` in Vitest so route handlers can run outside Next's server boundary;
proxy and Clerk provider behavior are covered by a production build and live request checks,
not by the unit suite.

- `tests/design-guard.test.ts` and `tests/contrast.test.ts` guard styles and 13 WCAG AA token
  pairs; `tests/smoke.test.ts` covers the five conditions.
- `lib/healthTripEngine*.test.ts` covers every condition x 2-20 days, caps, invariants,
  recovery, scores, determinism, Sun Life, validation, docs, and re-exports. Shared input is
  in `tests/healthTripFixtures.ts`.
- `lib/tinyfish*.test.ts`, `lib/swarmGoals.test.ts`, `lib/swarmTypes.test.ts`,
  `tests/swarm-route*.test.ts`, and `tests/swarm-runner*.test.ts` cover parsing, mapping,
  schemas, normalisation, bounded upstream text, request bounds, missing key, isolation,
  retries, mock, timeout, abort, and swarm_done. All network is mocked.
- `tests/swarm-recovery.test.ts` proves a stream that ends after STARTED recovers the
  authoritative COMPLETED run record, a recovered FAILED result retries once and then
  completes, and two failures produce one final error. `tests/swarm-runner-isolation.test.ts`
  proves an unexpected worker throw does not stop its sibling.
- `lib/swarmReducer*.test.ts`, `lib/swarmTelemetry.test.ts`, `hooks/swarmFrames.test.ts`,
  `hooks/swarmBatch.test.ts`, `lib/swarmMock.test.ts`, `tests/swarm-retry.test.ts`,
  `lib/swarmErrors.test.ts`, `lib/pacingStrip.test.ts`, `lib/careCard.test.ts`,
  `lib/describeTrip.test.ts`, `lib/onboarding.test.ts`, `lib/planMotion.test.ts`,
  `lib/verificationOverlay.test.ts`, `components/mission/missionMeta.test.ts`, and
  `components/ui/*.test.ts` cover telemetry, caps, retries, mock ordering, error copy,
  geometry, exact care-card text, tween and diff math, the tighten-only overlay, the
  onboarding gate, and headline copy.
- `lib/agent/*.test.ts` covers request bounds, assistant-text and JSON parsing, specialist
  normalisation, coordinate validation, concierge plan building and wire normalisation, the
  fallback route and its anchor sizing, prompt safety and limits, tool-activity humanisation,
  geocoding, planner reducer transitions and phase messages, and the warmup memo and retry.
  `hooks/plannerFrames.test.ts` covers the SSE frame guard. `tests/instrumentation.test.ts`
  proves the warmup starts only on the Node runtime and never during a production build.
- `lib/route/*.test.ts` covers great-circle distance, per-mode leg choice, the deterministic
  nearest-neighbour, 2-opt, and Or-opt pipeline, pinned meals, base skipping, walking caps,
  adjacent demanding days, waypoint truncation, and the exact Maps URL shape.
- `tests/agent-route.test.ts` runs the whole mock planner route through real SSE: roster, seven
  agent starts, immediate phase messages, activity, plan_ready, mock flags, map coordinates,
  planner_done last, and 400s for bad bodies. No OpenCode service or model call is made.
- `lib/geocode/*.test.ts` and `tests/geocode-route.test.ts` cover Photon and Nominatim
  parsing, city-level labels, duplicate removal, query bounds, coordinate bounds, reverse
  lookup, provider fallback, and the authenticated route errors.
- `lib/cache/*.test.ts`, `tests/cache-route.test.ts`, and `lib/db/tripCache.test.ts` cover
  normalised keys, exact and related planner reads, expiry, mock rejection, complete-set
  verification reads, recorded telemetry replay, terminal-frame order, a full route cache hit
  with no live session, and PostgreSQL exact/related and worker-set reads. The database file
  skips without `DATABASE_URL`.
- `lib/savedTrips.test.ts` covers saved-trip request bounds, normalisation, mock-plan rejection,
  and saved-trip id validation. `lib/db/savedTrips.test.ts` covers account-scoped upsert,
  list, read, delete, and cross-account isolation; it skips without `DATABASE_URL`. Route
  handlers require a Clerk user through the shared auth check and never touch data signed out.
- `lib/data/*.test.ts`, `lib/db/trips.test.ts`, and `lib/model/*.test.ts` cover computed dose,
  empty and over-cap days, block-level cap reconciliation, hike exertion, dossier and outcome
  parsing, free-text rejection, isotonic monotonicity, coefficient recovery, grouped folds,
  nested calibration, artifact validation, tier gating, PostgreSQL upserts, install scoping,
  mock and stale-row export filters, and training export.
- `tests/model-artifact.test.ts` proves the committed cohort, artifact, and model card are
  reproducible and that no live API, capture, or planning module imports the model; it also
  checks the documented ship gate. `lib/model/artifact.test.ts` proves malformed, stale, or
  zero-row artifacts fall back to the engine.
- `tests/agent-capture.test.ts`, `tests/swarm-capture.test.ts`, `tests/outcome-route.test.ts`,
  and `tests/data-loop.test.ts` run the real routes and repository against PostgreSQL:
  consent gating, computed dose, swarm stub creation, explicit label storage, wrong-install
  404, trip-log scoping, and capture to outcome to export to training to prediction. These
  files skip when `DATABASE_URL` is absent; `vitest` runs files sequentially so schema
  truncation cannot race across files.

Add pure-function tests beside the module or under `tests/`, named `*.test.ts`; Vitest includes
`**/*.test.ts`. No component-test libraries. Mock fetch in route and SSE tests; never call the
live planner or TinyFish from an automated check. Keep the design guard green rather than
exempting lines.

## 12. Known limitations and open questions

- The Sun Life stability window is unknown and stored as `null`; no placeholder number is
  shown. Confirm it with the plan administrator.
- Live TinyFish SSE runs were verified on 2026-11-21: the key, progress events, and preview
  URL worked; the preview host was `*.tinyfish.io`. The timeout was raised from 110s to 240s
  after an advisory run was cut off, then to 300s after a production medication/customs run
  timed out at four minutes. The follow-up production full three-worker run completed all three
  workers with no failures; advisory and coverage were rich, while pharmacy returned empty
  findings in that concurrent run after a standalone retry returned Salbutamol and local brands.
  A 2026-11-21 one-page run completed advisory and coverage while medication/customs exposed a
  Retry; the page keeps the failed column visible with its source and retry action. The new
  mission control was exercised in mock mode only: three iframes rendered, the fail path
  reached `SITE_BLOCKED`, and reduced motion switched every named class off. A 2026-11-22
  London, Ontario run completed all three workers in 110.1s under the older 120s/100s limits with
  recording enabled; three WebM recordings were archived and served from the authenticated
  route. The cached replay returned the same 25 steps, 10 sources, and 3 findings in about
  50-120 ms. A later provider run took 107s after a 65s queue delay, which exceeded the old
  120s client budget even though TinyFish completed it; the current 280s client budget and
  run-record recovery address that case. A 2026-11-22 full production route run for Hamilton,
  Ontario completed all three workers in 164.6s with 38 steps, 30 sources, and 3 findings,
  with no error or retry note. The recovery and retry paths are covered by mocked tests; a
  deliberately forced live stream drop and the stealth retry still need a live check.
  Clipboard permissions remain unverified.
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
- The runtime warmup runs at server start, so a normal first trip no longer pays service and
  agent-registration latency. A production 4-day run on 2026-11-21 showed the first phase at
  1 second, the first real searches at 3 seconds, and plan ready at 6m12s with all seven
  specialists complete. A 2026-11-22 London seed took 409.5s live with all seven complete;
  the exact cache hit returned in 269 ms and the signed-in onboarding click reached a ready
  plan in 582 ms. If the OpenCode service itself is still starting, the first request still
  waits; the mission band names that wait but cannot shorten it.
- Trips are supported from 2 to 20 days. The modeled trip-length pressure saturates at seven
  days, so an 8-20 day trip carries the same length pressure as a seven-day trip rather than a
  new, unvalidated curve. The daily pacing factors stay the same for every middle day; a
  clinician should review cumulative load and rest-day spacing before a long-trip pilot. The
  synthetic model cohort was trained on shorter trips, so long-trip predictions are an
  extrapolation.
- The workspace is intentionally one long page. On a phone, live verification sits below the
  full safety envelope; both streams keep running while the reader scrolls. Do not reintroduce
  tabs to shorten it.
- The KPI tween and four-second diff chip are wired to a plan prop change, but Edit trip
  remounts the workspace by design, so the current single-page flow does not exercise the chip
  in the browser. The math and lifetime are unit-tested; an in-place plan update will show it.
- The default free model hit a provider quota during development; production must set
  `OPENCODE_MODEL`. A quota failure maps to `agent_unavailable`.
- The embedded `@opencode/sdk` host requires Node 26 for `await using`; this app is on Node 22
  and uses `@opencode/client` against a running OpenCode service. A production deployment must
  provide and supervise that service. Production runs the CLI from `/usr/local/bin` and keeps
  its managed port on 49375 because the interactive root service owns 49374; the Go key and
  model live in `/etc/planmytrip.env`, not the repo.
- Geocoding is covered by mocked fetch tests; the live Nominatim pass has not been exercised
  against a real agent plan. Public OSM tiles and Nominatim are not production-scale endpoints.
- The live plan is rendered from the current SSE run. A finished plan can now be saved as an
  account-owned snapshot and reopened from `/trips`. There is no payment, booking, or rate
  limiting yet; those are product work beyond this step.
- Saved snapshots do not include live TinyFish verification, and they do not refresh source
  URLs or opening hours. The saved page rebuilds the engine envelope and labels the snapshot;
  confirm live details before booking.
- Cached plans and verification are snapshots with a date, not a live recheck. A planner hit
  can be an exact preference match or a destination + days + condition + medication fallback; the UI names
  the fallback, and a reader who needs current hours or advisories must re-run. The cache has
  no per-destination purge UI; rows expire after 30 days (plan) or 14 days (verification), and
  `npm run cache:seed` can replace a demo row. Archived recordings are local files with no
  automatic retention sweep yet; confirm storage, privacy, and deletion policy before a pilot.
- Location autocomplete, current location, and the map picker depend on browser permission
  and the configured geocoder. A denied permission or a provider outage leaves the typed city
  usable; the UI never fills an unverified place. Destination current location resolves to a
  city; starting point asks for the exact place and requests high-accuracy positioning. A
  desktop browser without GPS can still be approximate, so the map picker remains the precise
  fallback. The map pin becomes a destination label, not a stored coordinate; the itinerary
  still derives venue points from verified research. Production currently uses Photon's public
  endpoint; confirm its quota, attribution, and retention terms, and verify the permission copy
  with real users before a pilot.
- Consent and privacy: the destination, condition, medication name, and preferences are sent
  to the configured OpenCode model provider; place queries and a current-location coordinate
  go to the configured geocoder (Nominatim or Photon). Account identity and sessions are
  handled by Clerk. The research capture is opt-in and keyed only by a random
  localStorage install id; saved trips are separately account-owned. A retention policy,
  account-deletion path, and full privacy review are still required before charging users.
- The committed `lib/model/model.json` is trained on synthetic trips. No real outcome has
  contributed a label; never present it as clinical evidence or use it for a live plan.
- Responder bias and negative-label capture are unproven. A missing follow-up is excluded, not
  treated as a non-flare; a real pilot must measure who answers and who does not.
- TinyFish's custom `max_steps` is beta-gated on the current account and returns 403
  FORBIDDEN; the app therefore omits it and uses the provider default of 150 steps. Do not add
  it back until the account is enabled.
- Google social sign-in is not enabled on the production Clerk instance; `user_settings.social`
  is empty. Enabling it requires a Google OAuth client ID and secret in the Clerk dashboard,
  because production instances cannot use Clerk shared credentials. Until then the sign-in
  form shows email and password only.
- Clerk provides authentication; there is no rate limiting. PostgreSQL runs on the host; a
  production deployment still needs backups, access control, a retention/deletion path, and
  database monitoring. Deleting a Clerk user does not yet delete `saved_trips` rows.
- The production Clerk custom domain is routed through the same-origin proxy, not the
  `clerk.planmytrip.health` CNAME. The Dashboard domain's required CNAME records for email and
  account portal may still be pending; confirm DNS and sign-in methods after the first user
  signs up. The Clerk CLI is not authenticated on this host.
- The learned model does not change live caps yet. When it does, it may only tighten inside the
  engine ceiling; widening requires clinical review.
- Agent copy is model-generated and varies. The engine caps, over-cap caution, source links,
  "approximate location" label, and fallback route are the guardrails; do not remove them.
- The user-owned `README.md` is untouched; this guide is the working file. Light theme only;
  tokens allow a dark theme later.
- The engine invents no venues or geography. The concierge only selects from verified research.
- A returning traveler can reopen an account-owned saved plan, but the post-trip outcome form
  still appears only on the live plan. The saved page does not yet offer the outcome action;
  close that loop before a pilot that depends on real labels. `GET /api/trips` remains the
  anonymous install-scoped log, not the account list.
- The old rail and `ConstraintSidebar` were removed. The onboarding draft is the only input
  surface; do not reintroduce a permanent sidebar without revisiting the split-screen layout.
- Route times are modeled from assumed speeds, not live transit schedules, traffic, elevation,
  or opening hours. The Google Maps link is where the reader sees real times.
- The Maps handoff sends at most nine waypoints per day. A longer day links its first nine
  stops and shows a caution.
- Cross-day pacing rebalancing is not implemented. The concierge prompt forbids two demanding
  days in a row, the route removes avoidable walking on a demanding day, and the panel raises a
  caution when the pattern still appears.
- Transport and origin are not stored in the trip dossier. The route is recomputed from the
  plan on each render, so the dose loop is unaffected.
- A trip with several hotels anchors each day at the stay its own blocks reference, then at the
  first mapped stay. Luggage transfer between hotels is not modeled.

## 13. How to work here

1. Read this file, then `BUILD_LOG.md`.
2. Run `git log --oneline`, `git status`, and `git diff`; never discard uncommitted work.
3. Find the first unchecked step in section 2 and continue there.
4. Work in dependency order; no scope creep into pages, auth, payments, or analytics. The
   consented PostgreSQL capture store and the calibration model are in scope.
5. Run the full gate; update this file in the same commit as any change it describes.
6. Commit the exact message, push to `origin`, append to `BUILD_LOG.md`, and set its "Next action".
7. Stuck: three attempts, then change approach once, then log the error under Blockers. Never loop.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
