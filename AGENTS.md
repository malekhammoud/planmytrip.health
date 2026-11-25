# AGENTS.md

The single source of truth for PlanMyTrip.health. Read this first, then `BUILD_LOG.md` for
the current step and decisions. Update this file in the same commit as any change.

## 1. What this is

PlanMyTrip.health is health-aware trip planning for consumers: people who want their health,
energy, and budget to shape a real trip instead of guessing. It does four jobs: a team of
OpenCode specialists plans the trip, the biological engine turns the chosen health profile into
a paced safety envelope, one TinyFish browser check reads the Government of Canada travel
advisory for the destination, and live venue checks open the selected menus and booking pages
for current facts while the user watches. A consented outcome loop calibrates the pacing
estimate against what actually happened.

It is a planning aid, never medical advice: a well-typeset clinical chart crossed with a Swiss
timetable, typographic and ruled with hairlines. The pacing strip and the numbered route map
are the signature elements. The concierge plans venues and sequence; the engine owns the
physiological ceiling. The destination check can only tighten the plan, and venue evidence is
display-only. See section 7.

The data loop is part of the product, not analytics: one consented dossier per live run, one
explicit outcome per trip, and a versioned calibration artifact. The computed dose is the
asset; an agent's self-reported step count never enters a training row. See `docs/ML.md`.
Planning requires a Clerk account. Saved trips are account-owned snapshots; the consented
research capture stays anonymous and separate. See `docs/AUTH.md`. Clerk Billing sells the
Care Circle plan; the safety envelope and care card stay free. See `docs/BILLING.md`.

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
| 35. Cached agent recordings | [x] | `feat(ui): surface cached agent recordings` |
| 36. Lean onboarding headline | [x] | `feat(ui): remove onboarding explainer copy` |
| 37. TinyFish venue evidence | [x] | `feat(venue): add live menu and hotel evidence` |
| 38. Venue deck handoff | [x] | `fix(venue): link the plan to the venue deck` |
| 39. Venue heading scroll offset | [x] | `fix(venue): keep the venue heading below the sticky bar` |
| 40. Public landing page and brand mark | [x] | `feat(landing): add public landing page and brand mark` |
| 41. Clerk Billing and Care Circle | [x] | `feat(billing): add Clerk Billing plans and entitlements` |
| 42. Reliable account links | [x] | `fix(ui): make account links use full navigation` |
| 43. Production checkpoint and ops setup | [x] | `chore: checkpoint production state before ops integration` |
| 44. Local health probe and error reporting | [x] | `feat(ops): report errors and expose a local health probe` |
| 45. Clerk proxy health headers | [x] | `fix(ops): preserve internal health headers through Clerk proxy` |
| 46. Safe-deploy artifacts ignored | [x] | `chore: ignore safe-deploy rollback artifacts` |
| 47. Deploy sha ignored | [x] | `chore: ignore the generated deploy sha file` |
| 48. Health-safe feedback intake | [x] | `feat(feedback): add a health-safe feedback prompt and intake route` |
| 49. Full navigation from error boundaries | [x] | `fix(ops): allow full navigation from error boundaries` |
| 50. Consumer core reset | [x] | `refactor(product): remove medication, insurance, and pharmacy surfaces` |
| 51. Health-aware consumer landing | [x] | `feat(landing): reposition around health-aware travel` |
| 52. Site trust and support polish | [x] | `feat(site): polish pricing, trust, and support surfaces` |
| 53. Auth return paths | [x] | `fix(auth): preserve return paths after sign-in` |
| 54. Two-step health-aware onboarding | [x] | `feat(onboarding): rebalance the two-step health-aware flow` |
| 55. Consumer copy and feedback focus | [x] | `fix(ui): polish consumer copy, tap targets, and feedback focus` |
| 56. Live limits and cache identity | [x] | `fix(backend): harden live reservations, limits, and cache identity` |
| 57. Destination check surface | [x] | `feat(ui): polish destination check surface` |
| 58. Workspace and saved-trip polish | [x] | `feat(ui): polish workspace command surface and saved trips` |
| 59. Route stays open, check exposed | [x] | `fix(ui): keep the route open and expose the destination check` |
| 60. Privacy and account deletion | [x] | `feat(privacy): remove recordings and add account deletion` |
| 61. Cross-origin deletion guard | [x] | `fix(account): reject cross-origin deletion requests` |
| 62. Anonymous capture privacy copy | [x] | `fix(privacy): clarify anonymous capture deletion` |
| 63. First-day hospital guidance | [x] | `fix(engine): keep hospital guidance to the first day` |
| 64. Sign-up legal links | [x] | `fix(auth): link terms and privacy on sign-up` |
| 65. Investor deck alignment | [x] | `docs(pitch): align the investor deck with the consumer reset` |
| 66. Consumer reset documentation | [x] | `docs(agents): document the consumer product reset` |
| 67. Reset documentation alignment | [x] | `docs(agents): align the reset with the final workflow` |
| 68. Reset deployment record | [x] | `docs(agents): record the production reset deployment` |
| 69. General relaxation default | [x] | `feat(profile): add a general relaxation default` |
| 70. Destination house ads | [x] | `feat(ads): add destination-personalized house ads` |
| 71. Report ads and conversion analytics | [x] | `feat(ads): extend house ads to every report` |

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
npm run cache:seed -- --run-id <id>   # seed the destination-check cache from a capture row
npm run cache:seed -- --plan-file <json>  # seed a planner cache from a saved run
npm run ads:report          # aggregate house-ad clicks from PLANMYTRIP_ADS_DIR
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
| `TINYFISH_API_KEY` | Server only, destination and venue routes | The destination check emits `worker_error` code `missing_api_key`; venue checks fail each page the same way. Both streams still return 200. Never log, echo, or commit it. |
| `PLANMYTRIP_CACHE` | Server only, cache store | Set `0` to disable both cache tiers. Enabled by default when a database is configured. |
| `PLANMYTRIP_CACHE_MEMORY` | Server only, cache store | Force (`1`) or disable (`0`) the in-process tier. Production enables it automatically when `DATABASE_URL` is set; tests use `1` without a database. |
| `SWARM_MOCK` | Server only, destination check route | Only when `1` and `NODE_ENV !== "production"`; mock events carry `mock: true`. Ignored in production. |
| `SWARM_MOCK_SPEED` | Server only, mock timeline | Multiplies the scripted mock clock; tests use `50`. Ignored in production. |
| `SWARM_MOCK_FAIL` | Server only, mock timeline | The `advisory` worker id fails with `site_blocked`; used to exercise the error UI. Ignored in production. |
| `AGENT_MOCK` | Server only, planner route | Only when `1` and `NODE_ENV !== "production"`; every planner payload carries `mock: true`. Ignored in production. |
| `PLANMYTRIP_LIVE_DISABLED` | Server only, all live routes | Set `1` to stop new live planner, destination, and venue runs without a deploy. Cached results and the safety envelope still work. |
| `PLANMYTRIP_PLANNER_MAX_CONCURRENT` | Server only, planner guard | Global simultaneous live plans. Default 2; clamped to 1-20. One live plan per account is always enforced. |
| `PLANMYTRIP_PLANNER_COOLDOWN_SEC` | Server only, planner guard | Seconds before an account may start another live plan. Default 15; `0` disables the cooldown. |
| `PLANMYTRIP_SWARM_MAX_CONCURRENT` | Server only, destination guard | Global simultaneous destination checks. Default 3; clamped to 1-20. |
| `PLANMYTRIP_SWARM_COOLDOWN_SEC` | Server only, destination guard | Seconds before an account may start another destination check. Default 15. |
| `PLANMYTRIP_VENUE_MAX_CONCURRENT` | Server only, venue guard | Global simultaneous venue passes. Default 2; clamped to 1-20. |
| `PLANMYTRIP_VENUE_COOLDOWN_SEC` | Server only, venue guard | Seconds before an account may start another venue pass. Default 30. |
| `PLANMYTRIP_VENUE_DAILY_LIMIT` | Server only, venue budget | Venue passes per account per UTC day. Default 8; `0` denies every pass. |
| `PLANMYTRIP_GEOCODE_PER_MINUTE` | Server only, geocode routes | Autocomplete and reverse-geocode requests per account per minute. Default 60; `0` denies every request. |
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
| `DATABASE_URL` | Server only, `lib/db/postgres.ts` | Required for saved trips, billing reservations, cache, and capture. Scoped APIs return 500 JSON and capture stays best-effort until a database is configured. |
| `DATABASE_SSL` | Server only, Postgres pool | Set `true` only for a managed provider that requires TLS. Certificates are validated; use `NODE_EXTRA_CA_CERTS` for a private CA rather than disabling verification. |
| `DATABASE_STATEMENT_TIMEOUT_MS` | Server only, Postgres pool | Per-statement timeout. Defaults to 10000; values below 1000 fall back. A hung query fails instead of pinning a pool client or an SSE stream. |
| `DATABASE_QUERY_TIMEOUT_MS` | Server only, Postgres pool | Per-query client timeout. Defaults to 10000; values below 1000 fall back. |
| `PLANMYTRIP_CAPTURE_MOCK` | Server only, capture paths | Only when `1`; allows mock planner and destination runs to be stored for tests. Never enable in production. |
| `PLANMYTRIP_FEEDBACK_DIR` | Server only, feedback route | Local JSONL fallback directory. Defaults to `/var/lib/planmytrip/feedback`; must be writable by the app user. |
| `PLANMYTRIP_ADS_DIR` | Server only, ad-click route and report | Local JSONL fallback directory for aggregate house-ad clicks. Defaults to `/var/lib/planmytrip/ads`; must be writable by the app user. No account id, IP address, or health field is stored. |
| `NEXT_PUBLIC_POSTHOG_KEY` | Browser, `lib/analytics.ts` | Public PostHog project key. A built-in project key is used when empty; never use a personal API key. |
| `NEXT_PUBLIC_POSTHOG_HOST` | Browser, `lib/analytics.ts` | Defaults to `/ingest`, proxied by `next.config.ts` to PostHog. |
| `OPS_HEALTH_TOKEN` | Server only, `/api/health` | When set, the local probe requires `x-ops-token`; an empty value leaves it local-only and unauthenticated. Never expose it to the browser. |
| `OPS_INGEST_URL` | Server only, ops and feedback routes | Local control-plane endpoint. Defaults to `http://127.0.0.1:3100`. |
| `OPS_INGEST_TOKEN` | Server only, ops and feedback routes | Shared control-plane token. Reporting and central feedback stay disabled when empty. |
| `OPS_REPORTING` | Server only, server reporter | Set `0` to disable server error forwarding even when a token is present. |
| `DEPLOY_SHA` | Server only, health probe and ops event | Release marker. The health route falls back to `/opt/planmytrip.health/.deploy-sha`. |
| `NEXT_PUBLIC_RELEASE` | Browser, client error reporter | Optional release label sent with browser error reports. Never a secret. |
| `NODE_ENV` | Next.js, mock guards | Next sets it; production disables the mock modes. |

`.env.example` is committed; `.env*` is ignored except it. Never read, print, or commit a real
`.env*` file. Local use: `cp .env.example .env.development.local`, set the Clerk pair,
`TINYFISH_API_KEY`, `DATABASE_URL`, and optionally `OPENCODE_MODEL`, then run
`npm run db:init` and `npm run dev`. The development-only filename keeps the production
`next start` from reading the local secret file. The OpenCode service must be installed and
authenticated for live planning; `AGENT_MOCK=1` needs neither a key nor a service. Production
keeps database, Clerk, and provider secrets in `/etc/planmytrip.env`, and leaves the cache
enabled. The recording archive and its `TINYFISH_RECORDING` / `PLANMYTRIP_RECORDINGS_DIR`
variables were removed from production on 2026-11-25; no recording files or variables remain.
The production Clerk application is
`app_3MR7sJ2fhslkGXYl4yRqjseO13C`; its production domain uses the same-origin Frontend API
proxy at `https://planmytrip.health/__clerk`. Dashboard sign-in does not authenticate the
Clerk CLI; run `npx -y clerk@latest auth login` on the host before targeting account-level CLI
resources. See `docs/AUTH.md`.

## 5. Architecture

Every tracked source file, annotated; `package-lock.json` and generated files
(`next-env.d.ts`, `.next`, `tsconfig.tsbuildinfo`) are omitted by category.

```text
app/  globals.css, layout.tsx, page.tsx, error.tsx, global-error.tsx, icon.svg, apple-icon.png, privacy/page.tsx, terms/page.tsx, model/page.tsx, pricing/page.tsx, account/[[...account]]/, sign-in/[[...sign-in]]/, sign-up/[[...sign-up]]/, trips/, trips/[id]/, mock-browser/[worker]/, api/account/delete/route.ts, api/agent-plan/route.ts, api/feedback/route.ts, api/geocode/search/route.ts, api/geocode/reverse/route.ts, api/health/route.ts, api/ops/report/route.ts, api/saved-trips/route.ts, api/saved-trips/[id]/route.ts, api/travel-swarm/route.ts, api/trips/outcome/route.ts, api/venue-research/route.ts
lib/  engine: healthTripEngine.ts (entry), healthTripTypes.ts, types.ts, conditionProfiles.ts, healthScore.ts, itineraryBuilder.ts
      swarm: swarmTypes.ts (wire contracts), swarmConfig.ts, swarmState.ts, swarmReducer.ts, swarmRunner.ts, swarmGoals.ts, swarmMock.ts, swarmTelemetry.ts, swarmErrors.ts, sse.ts, tinyfish.ts, tinyfishEvents.ts, tinyfishRuns.ts (run detail)
      agent: agentTypes.ts (wire contracts), agentRequest.ts, agentProfiles.ts, agentPrompts.ts, agentConfig.ts, agentClient.ts, agentWarmup.ts, agentRunner.ts, agentSession.ts, agentParse.ts, agentPlanParse.ts, agentFallback.ts, agentGeocode.ts, agentEvents.ts, agentMock.ts, plannerReducer.ts, plannerStage.ts
      data: types.ts (versioned contract), dose.ts, tripDossier.ts, capture.ts, validation.ts
      db: postgres.ts (pg pool, timeouts, schema), trips.ts (capture repository), savedTrips.ts (account repository), account.ts (account deletion), billingUsage.ts (atomic allowance reservation)
      billing: plans.ts (plan and feature contract), server.ts (request entitlement snapshot)
      model: types.ts, math.ts, features.ts, logistic.ts, calibration.ts, train.ts, predict.ts, artifact.ts, model.json
      output: describeTrip.ts, pacingStrip.ts, careCard.ts, planMotion.ts
      verification: verificationOverlay.ts
      route: routeTypes.ts (wire contracts), geometry.ts, legs.ts, optimizer.ts, routeStops.ts, routeDay.ts, routePlan.ts, mapsLink.ts
      cache: cacheKey.ts (identities), cacheStore.ts (memory and Postgres), planCache.ts, swarmCache.ts, cachedEvents.ts, venueCache.ts
      geocode: types.ts (place contracts), search.ts (Photon/Nominatim search and reverse)
      venue: types.ts (evidence and request contracts), goals.ts (menu and hotel schemas), runner.ts, url.ts (public URL gate), format.ts, venueState.ts (pure reducer)
      ops: client.ts (browser reporter), server.ts (server reporter), pendingWrites.ts (bounded settle)
      live: concurrency.ts (lease guard), liveLimits.ts (env guard), rateLimit.ts (window and daily budgets)
      mapTiles.ts (shared tile URL and attribution), redirects.ts (safe return paths), clerkAppearance.ts, dates.ts, onboarding.ts, savedTrips.ts (account contract)
hooks/  useSwarm.ts, swarmStream.ts, swarmFrames.ts, swarmBatch.ts, useNow.ts, useElapsed.ts, useReducedMotion.ts, usePhaseAnnouncement.ts, usePlanMotion.ts, useAgentPlan.ts, useVenueResearch.ts, venueFrames.ts, plannerStream.ts, plannerFrames.ts
components/  Logo.tsx, Onboarding.tsx, LocationField.tsx, LocationPickerDialog.tsx, PlannerHome.tsx, PlanWorkspace.tsx, WorkspaceSection.tsx, SiteChrome.tsx, FeedbackButton.tsx, CommandBar.tsx, CommandDock.tsx, LiveRail.tsx, PlanPanel.tsx, DayFocus.tsx, SaveTripButton.tsx, SavedTripView.tsx, DeleteSavedTripButton.tsx, DeleteAccountButton.tsx, UpgradeCallout.tsx, AgentTeamPanel.tsx, AgentRoster.tsx, AgentActivityFeed.tsx, AgentPlanView.tsx, AgentPlanDays.tsx, AgentPicks.tsx, RoutePanel.tsx, TripMap.tsx, ItineraryBoard.tsx, PacingStrip.tsx, VerificationAdjustments.tsx, TripOutcomePanel.tsx, WorkerFindings.tsx
components/landing/  LandingPage.tsx, ProductShot.tsx
components/venue/  VenueMissionControl.tsx (run bar, tabs, activity, source ledger), VenueWorkerTile.tsx, VenueLiveView.tsx (iframe, clock, fullscreen), VenueEvidencePreview.tsx, VenueEvidenceCards.tsx
components/mission/  MissionControl.tsx, FocusView.tsx, ActivityFeed.tsx, SourcesList.tsx, FindingsReveal.tsx, PreRun.tsx, Elapsed.tsx, NewMark.tsx, missionMeta.ts
components/ui/  index.ts, Button.tsx, Callout.tsx, Checkbox.tsx, DataRow.tsx, Disclosure.tsx, Field.tsx, LinkButton.tsx, Metric.tsx, NumberInput.tsx, SectionHeader.tsx, Select.tsx, Skeleton.tsx, Slider.tsx, StatusGlyph.tsx, TextArea.tsx, TextInput.tsx, numberInput.ts (clampInteger), sliderFill.ts (sliderFillPercent), metricBars.ts (metricBarWidths)
public/pitch/  index.html, deck.css, deck.js, basil.jpg, fonts/
public/landing/  route-detail.webp, venue-detail.webp, safety-envelope.webp
scripts/  db-init.ts, export-training.ts, synthetic.ts, train-model.ts, seed-cache.ts, clerk-billing.json
data/  synthetic-trips.jsonl
docs/  ML.md, MODEL_CARD.md, PITCH.md, ROUTE.md, VENUE.md, AUTH.md, BILLING.md
tests/  contrast.test.ts, design-guard.test.ts, smoke.test.ts, instrumentation.test.ts, model-artifact.test.ts, data-loop.test.ts, billing-gates.test.ts, live-guards.test.ts, swarm-route.test.ts, swarm-runner.test.ts, swarm-recovery.test.ts, swarm-retry.test.ts, agent-route.test.ts, agent-capture.test.ts, swarm-capture.test.ts, account-delete-route.test.ts, outcome-route.test.ts, cache-route.test.ts, geocode-route.test.ts, venue-route.test.ts, healthTripFixtures.ts, swarm-route-fixtures.ts, mocks/clerk-server.ts
module tests  lib/: onboarding.test.ts, careCard.test.ts, describeTrip.test.ts, healthTripEngine.test.ts, healthTripEngineRules.test.ts, pacingStrip.test.ts, planMotion.test.ts, savedTrips.test.ts, redirects.test.ts, rateLimit.test.ts, concurrency.test.ts, swarmGoals.test.ts, swarmMock.test.ts, swarmTypes.test.ts, swarmReducer.test.ts, swarmReducerResults.test.ts, swarmTelemetry.test.ts, swarmErrors.test.ts, verificationOverlay.test.ts, tinyfish.test.ts, tinyfishEvents.test.ts; lib/billing/: plans.test.ts; lib/cache/: cacheKey.test.ts, planCache.test.ts, swarmCache.test.ts, cachedEvents.test.ts, venueCache.test.ts; lib/geocode/: types.test.ts, search.test.ts; lib/venue/: types.test.ts, url.test.ts, format.test.ts, venueState.test.ts, runner.test.ts; lib/ops/: pendingWrites.test.ts; lib/dates.test.ts; lib/agent/: agentRequest.test.ts, agentWarmup.test.ts, agentParse.test.ts, agentPlanParse.test.ts, agentFallback.test.ts, agentEvents.test.ts, agentPrompts.test.ts, agentGeocode.test.ts, plannerReducer.test.ts, plannerStage.test.ts; lib/route/: geometry.test.ts, legs.test.ts, optimizer.test.ts, routePlan.test.ts, mapsLink.test.ts; lib/data/: dose.test.ts, tripDossier.test.ts; lib/db/: trips.test.ts, savedTrips.test.ts, account.test.ts, tripCache.test.ts, billingUsage.test.ts; lib/model/: artifact.test.ts, calibration.test.ts, logistic.test.ts, train.test.ts; components/ui/: sliderFill.test.ts, metricBars.test.ts, numberInput.test.ts; components/mission/: missionMeta.test.ts; hooks/: swarmFrames.test.ts, swarmBatch.test.ts, plannerFrames.test.ts, plannerStream.test.ts, venueFrames.test.ts
root  proxy.ts, package.json, tsconfig.json, next.config.ts, eslint.config.mjs, vitest.config.mts, instrumentation.ts, instrumentation-client.ts, .github/workflows/ci.yml, .env.example, .gitignore, README.md, AGENTS.md, BUILD_LOG.md
```

Data flow: `Onboarding` collects a `TripDraft` in two steps, "The trip" and "Your pace", and
`PlannerHome` normalizes it into a `TripConfig`, creates a per-run id, increments `deployNonce`,
and reveals `PlanWorkspace`. `PlannerHome` memoizes `buildHealthTripPlan` and passes the engine
plan to the workspace. `PlanWorkspace` calls `useAgentPlan`, which POSTs `/api/agent-plan`; `useSwarm`
POSTs `/api/travel-swarm` with the same run and install ids when the account has the live check.
Planner events flow through `plannerFrames`/`plannerReducer` into the command bar, seven-agent
deck, activity rail, route stage, and map; TinyFish events flow through
`useSwarm`/`swarmReducer` into the destination-check surface and the tightening overlay. The
engine plan feeds the safety envelope and supplies every concierge day with its step and
walking ceiling. The engine and the safety envelope render independently of both live layers.
The finished plan is also projected into a travel route in `AgentPlanView`; the route is derived
from the plan and never writes back. After `plan_ready`, `useVenueResearch` POSTs the selected
stay and meal places to `/api/venue-research`; checked menus and rates flow into the checked
places deck and the plan's place rows. Venue evidence is a separate display layer and never
changes the engine envelope, the computed dose, or the cache identity of the plan.

`PlannerHome` owns a random install id and a per-run id; both agent POSTs carry them. On a live
`plan_ready`, the planner route rebuilds the engine plan server-side and writes a consented
dossier; a cache replay never writes a dossier or consumes a plan. On `swarm_done` the
destination route writes bounded findings when consent was given. The finished plan posts one
explicit outcome from its disclosure. A missing outcome is excluded from training, never read
as a negative.

`app/page.tsx` reads `auth()`. A signed-out visitor sees the public landing page (an inline
render, not a redirect), which explains the product, shows the product captures, and routes to
`/sign-up`; a signed-in visitor sees the planner under `PlannerHome`. Planning still requires an
account. The signed-in header carries `Saved trips` and the Clerk `UserButton`. `/trips` lists
account-owned snapshots with Older/Newer paging and `/trips/[id]` reopens one. The install id
and the consented research capture remain anonymous and are not linked to the Clerk account.

### Cached planner and destination check

`lib/cache/` is a two-tier result cache in front of the planner and the destination check.
`cacheKey.ts` normalises destination, condition, preferences, budget, transport, check-in date,
and party size into a canonical key; `cacheStore.ts` keeps an in-process map over an idempotent
`trip_cache` table. A planner read tries the exact key, then the newest row for the same
destination, days, and condition and labels that related match in the interface. A related row
is only served when its check-in date and party size also match; rows written before those
fields existed are an honest miss. A destination-check read requires every requested worker, so
a retry can reuse a complete recorded set. Plans live 30 days and destination checks 14 days; a
hit records its hit count without delaying the response. Venue evidence has its own
place-scoped cache and TTLs, described in `docs/VENUE.md`.

`/api/agent-plan` checks the cache before it touches OpenCode. A hit emits the same planner
contract in one fast pass: `planner_started`, one `agent_result` per agent, `plan_ready` with
`cached`, `cachedAt`, and `cacheMatch`, then `planner_done`. `/api/travel-swarm` does the same
with `worker_status`, `worker_started`, recorded `worker_sources` and `worker_progress`,
`worker_complete`, then `swarm_done`. Cached frames are real recorded telemetry, never invented
progress; they carry `cached: true`, and the workspace shows a "Cached plan" or "Checked"
callout with the original date. Both routes add `X-Plan-Cache` or `X-Swarm-Cache: hit|miss`.
A cached replay also skips the billing reservation, so it never consumes a live-plan allowance
or creates a research dossier.

A live miss writes the finished result after the terminal frame. There is no recording archive:
`/api/recordings`, `lib/cache/recordings.ts`, and `swarmArchive.ts` were removed, and TinyFish
is never asked for a video. The live preview URL still expires and is never replayed from cache.
Cache keys exclude origin, run id, install id, and Clerk identity; the cache writes no training
label and never runs for mock data. `npm run cache:seed` can seed a destination-check row from
an existing capture or a planner row from a saved JSON file.

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
places, and sources stay the captured snapshot. Live destination findings are not stored or
rechecked there. Venue evidence is not stored either: the saved page shows an explicit
"Refresh menus and rates" action instead of opening live pages on load. Deleting a saved trip
asks for a second confirmation. The anonymous `trip_captures` table is unchanged and never
stores the Clerk user id.

`/trips` reads 30 rows plus one sentinel, so it offers Older/Newer paging without a total
count. The page and API both enforce the free one-saved-trip limit before writing. Account
deletion is `POST /api/account/delete`: it rejects a cross-origin browser request, removes the
account's `saved_trips` and `billing_usage` rows in one transaction, then deletes the Clerk
user. Anonymous captures are not linked to the account and are deliberately not deleted. The
old install-scoped `GET /api/trips` log and `/api/recordings` route are gone.

The Clerk production keys live in `/etc/planmytrip.env`; never put the secret in a
`NEXT_PUBLIC_*` variable, a committed file, or a log. The production application is
`app_3MR7sJ2fhslkGXYl4yRqjseO13C`. The Dashboard selection does not authenticate the Clerk CLI;
use `npx -y clerk@latest auth login` on the host before account-level CLI commands. The
prebuilt form reads literal Paper and Ink values from `lib/clerkAppearance.ts`; Clerk does not
resolve `var(--token)` in its own color variables. `lib/redirects.ts` validates return paths
for `/sign-in` and account links, so a signed-out click returns to the page it came from and
never becomes an open redirect. Full schema, privacy, and rollout notes are in `docs/AUTH.md`;
the public notices are `/privacy` and `/terms`.

### Billing and entitlements

Clerk Billing is enabled for the production application. The launch catalog is
`free_user` ("Free Preview", $0) and `care_circle` ("Care Circle", $9/month or $60/year).
Annual is the intended plan. The instance is not opted into Clerk's separate "Annual-only
plans" update, so the monthly interval is visible; once that update is enabled, set
`amount` to `0` in `scripts/clerk-billing.json` and re-apply to remove it. Clerk Billing
supports recurring subscriptions only, so the research-recommended one-time Trip Pass needs
Stripe Checkout outside Clerk Billing.

`lib/billing/plans.ts` maps Clerk plan and feature claims to explicit limits:
`free_user` gets one live plan per calendar year, 7 days, one saved trip, no live destination
check, and no venue research. `care_circle` gets two live plans per calendar month, 20 days,
unlimited saved trips, and both live layers. The safety envelope and care card are always
free. `lib/billing/server.ts` reads `auth()` once; every paid API enforces its feature
server-side before work starts. `live_verification` is presented as the "Live destination
check" feature: it covers the advisory check plus live venue menus and rates. `venue_research`
is the separate venue feature. `lib/db/billingUsage.ts` reserves a live plan atomically: an
advisory lock over the user, metric, and period wraps the count and insert, and a database
failure returns `error` so the route fails closed instead of granting an unmetered run. Cache
hits, mock runs, and cached replays do not consume a plan. The server generates the usage event
id, so a client `runId` cannot manufacture usage.

`/pricing` renders Clerk's `PricingTable`, `/account` renders `UserProfile` for plan and
invoice management, and the header/footer link both. `UpgradeCallout` replaces a paid
surface on the free plan. `SaveTripButton` handles the server's `saved_trip_limit` response.
Two live plans a month is 24 live plans a year; at $2-$4 of compute per live trip, heavy
use can exceed the $60 annual price. Monitor p95 cost before promoting the plan. The full
catalog, commands, caveats, and pilot plan are in `docs/BILLING.md`.

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
the mission stage with a four-step rail, the plan and check clocks, specialist progress, the
live-plan allowance, and the trip actions. Below it a named-area CSS grid reflows through four
stages: the route stage leads while sessions open (`forming`), the deck keeps the width while
research lands (`researching`), the deck stays open while the concierge composes (`composing`),
and the finished route leads while the deck collapses (`ready`). The destination check and
checked places open while they run; at ready the route and "Pacing and safety" open. Panels
move by grid area, never by unmounting, so both streams and every venue preview frame continue
while the layout changes.

`WorkspaceSection` is the relevance layer. Each live surface opens only while it carries the
work: the route stage and research deck while sessions run, the destination check while it
checks, checked places while venues are read, and pacing and safety once the plan is ready. A
settled surface collapses to one line with its real counts; the reader can reopen any section.
The body stays mounted and becomes inert while closed, so a collapse never aborts a stream or
unmounts a preview. `components/ui/Disclosure.tsx` supplies the accessible button, the animated
grid-row body, and the reduced-motion path. `lib/agent/plannerStage.ts` derives the stage, the
surface mode, the rail state, and the newest agent purely from the planner state.

A fixed six-item `CommandDock` appears below 1024px and jumps to Route, Team, Places, Check,
Safety, and Feed. A running stream carries a live dot. Every jump target has scroll margin for
the fixed header and bar.

`DayFocus` is the map control: "All days" or one 44px day button, arrow, Home, and End keys,
and a focus strip with that day's estimate and ceiling, walking distance, recovery minutes, and
checkpoint. The workspace starts on "All days"; selecting one fits the map to its stops, dims
the other markers, opens the matching route and day-plan rows, and rules the matching envelope
row. A `Map` action on a route day and a "Show ... on the map" action in an open day scroll the
map back into view.

The planning deck shows only agents that are still working, with phase, role, and newest line.
Completed and failed agents fold into one "Completed agents" disclosure. At ready the deck is
also collapsed by its section. The deck follows the agent with the newest activity line unless
the reader pins one, and the focused agent's history, result, or error opens below.

The activity rail switches between the planning signal and the destination feed. It follows
the stream with the newest real line, and the destination feed once the plan is ready, unless
the reader pins one; `Follow live` restores auto-follow. Both feeds stay mounted. The planner
signal shows the newest two lines with an "Earlier updates" disclosure; the destination feed
shows the newest three with an "Earlier activity" archive. The destination check itself is one
calm card: pre-run copy, a status line, a "Watch live" disclosure, and source-backed findings;
it shows no raw JSON, step count, tempo strip, or provider internals. The safety envelope keeps
the KPI strip, every day's caps, and the checkpoint visible; the generic blocks and pacing strip
sit behind a "How this day is modeled" disclosure.

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

### Live venue research

`lib/venue/` and `/api/venue-research` are the TinyFish extraction layer. The concierge still
discovers places and synthesises the route; TinyFish now opens the exact menu or booking URL
and returns structured page facts. It is not the destination-check layer and it requests no
recording or preview archive.

The route requires Clerk auth, declares `maxDuration = 300`, and validates a bounded request:
destination, optional ISO check-in, 1-20 days, 1-8 travellers, and up to eight places. A stay
job opens `bookingUrl ?? sourceUrl`; an eat job opens `menuUrl ?? sourceUrl`. Hotel jobs run
only with a check-in date and use `checkIn + days` as check-out. Each plan checks at most two
hotels and three restaurants, three browsers at a time, with a 75s job timeout, 45s run-record
recovery, a 255s run budget, one retry, and a fallback from the preferred URL to the plan's
source page. `lib/venue/url.ts` rejects any URL that is not absolute http(s) or whose host is
loopback, private, link-local, unique-local, multicast, reserved, or single-label before a
browser job starts. The route enforces one live pass per account, two globally, a 30-second
cooldown, and eight passes per account per UTC day by default. The terminal frame always
arrives inside the route budget.

The venue SSE contract mirrors the other two streams. Every frame carries `worker`, `seq`,
`ts`, and optional `cached`. `venue_started` lists every job; `venue_status` moves
queued/running/complete/error; `venue_activity` carries one bounded search, read, note, or
error line; `venue_streaming_url` is the live TinyFish preview; `venue_sources` grows the
ledger; `venue_result` carries one validated menu or hotel snapshot; `venue_error` maps a calm
failure; `venue_done` is always last with completed, failed, and summary counters.
`hooks/venueFrames.ts` rejects unknown events, unsafe preview URLs, malformed evidence, and
bad worker ids. `lib/venue/venueState.ts` owns the pure reducer, timestamped activity, worker
clocks, source dedupe, and the checked-page source fallback. The route never echoes a raw
provider body, key, or session token.

`VenueMissionControl` is the surface. A four-cell run bar shows pages checked, elapsed clock,
evidence counts, and sources/actions. Venue tabs follow the browser with the newest action
unless the reader pins one; arrow, Home, and End keys move between tabs. `VenueLiveView` keeps
one iframe per venue mounted and hidden, shows the TinyFish preview while the browser is live,
then replaces it with `VenueEvidencePreview` built from the checked facts. The hero carries a
real per-page clock, action count, LIVE marker, and a Fullscreen API expand action. The right
rail shows the merged, timestamped activity feed and the focused worker's source ledger; the
checked page is always one source, even when the provider exposes no search results.
`VenueEvidenceCards` renders dated hotel quotes with taxes, cancellation, booking host, and
source handoff, plus menus grouped by printed section, prices, descriptions, and the page's
own allergen notes. Missing values read "Not stated"; nothing is invented. The evidence also
appears on the plan's selected-place rows and in the plan summary line, so venue facts sit
inside the itinerary rather than only in a separate report.

The checked facts never feed the safety envelope, the dose, or the day ceilings. Menus and
rates are display evidence; the engine remains the safety authority. A failed page keeps its
tile and error copy, the successful facts stay usable, and a partial run shows a caution with
a retry that returns cached facts immediately. Mock plans never call the route; a missing key
fails each worker with `missing_api_key` and still ends with `venue_done`.

`lib/cache/venueCache.ts` stores one record per place and URL. The v2 key includes the place
id, so two restaurants that share a city listing page cannot overwrite each other. Menus live
7 days and room rates 12 hours. The cache envelope keeps the evidence, the recorded sources,
the recorded activity offsets, and the duration; a cache hit replays real recorded telemetry
with `cached: true`, never invented progress. Legacy evidence-only rows still read and gain
their checked page as a source. Venue evidence is separate from the plan cache, so a cached
plan stays fast and the venue deck can load, replay, or refresh independently. The full
endpoint, event, cache, safety, and live-check contract is in `docs/VENUE.md`.

### Data loop and calibration model

Capture is opt-in on the onboarding health step. `PlannerHome` owns a random install id
(localStorage, never a cookie) and a per-run `runId`; both agent POSTs carry them.
`useAgentPlan`/`useSwarm` pass them through, and `parsePlannerRequest`/`isSwarmRequestBody`
validate them. The planner route rebuilds the engine plan server-side on a live `plan_ready`
and writes a `TripDossier`; a cached replay never writes one. The destination route writes
bounded findings on `swarm_done`. The finished plan renders `TripOutcomePanel`, which posts one
explicit outcome to `/api/trips/outcome`. The old install-scoped `GET /api/trips` list was
removed with the recordings cleanup; there is no browser trip log now.

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

`lib/db/postgres.ts` owns a parameterized `pg` pool, per-query and per-statement timeouts, and
the idempotent `trip_captures`, `model_runs`, `saved_trips`, `trip_cache`, and `billing_usage`
schema; `npm run db:init` applies it. Production, development, and tests use separate
PostgreSQL databases through `DATABASE_URL`. Capture is best-effort but the planner and
destination streams wait a bounded two seconds for their pending writes before closing, so a
hung database cannot hold the terminal frame open. `scripts/synthetic.ts` writes
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
| `general_wellness` | 10,000 | 6.0 km | 30 min, required | 10 | Default relaxation and stress-recovery pace; not a fitness assessment. |
| `asthma_respiratory` | 7,000 | 4.0 km | 30 min, required | 22 | Breath-limited ceiling with a short afternoon recovery. |
| `chronic_fatigue_pots` | 4,000 | 2.5 km | 90 min, required | 25 | Low load with a long recovery for orthostatic symptoms. |
| `pregnancy_second_trimester` | 5,000 | 3.0 km | 45 min, required | 18 | Moderate load with rest, heat limits, and food safety. |
| `severe_food_allergy` | 6,000 | 3.5 km | 30 min, optional | 20 | Flexible recovery; emergency planning matters more. |
| `cardiac_hypertension` | 5,000 | 3.0 km | 45 min, required | 22 | Moderate load with midday recovery and altitude limits. |

`PACING_POLICY`: first-day 0.45, middle 0.8, final 0.4 of the ceiling. To add a condition:
add the id and label in `lib/types.ts`; add a readonly profile with a VERIFY line and floor;
add a `CONDITION_CHECKPOINTS` entry; update this table and section 9; run both engine test
files. Exhaustive `Record<Condition, ...>` types fail typecheck until complete.

### Onboarding and live workspace

`PlannerHome` owns the two screens (`onboarding` or `workspace`), the trip, the per-run id,
`deployNonce`, and the anonymous install id. `app/page.tsx` only chooses the public landing or
the signed-in planner. `Onboarding` owns its draft, the two steps, the explicit health profile,
and validation. The page renders both screens and hides the inactive one with `hidden`, so
editing never discards a running workspace. `onComplete` normalizes the draft, sets the trip,
creates a run id, increments `deployNonce`, and reveals the workspace; `onCancel` resets the
draft and returns to the running workspace. The workspace is keyed by `deployNonce`, so a new
build or replan remounts it at the top and aborts older streams.

`Onboarding` is one focused screen, not a rail, and is labelled 01 The trip / 02 Your pace.
Step 01 collects destination (the only gate for this step), start date, duration, travellers,
and the optional starting point. Duration is a bounded integer field up to the plan's
`maxTripDays` (2-20 days), not a slider. Destination and the optional starting point are both
`LocationField` comboboxes: typing searches `/api/geocode/search` after a 220ms debounce and
offers at most six city or place rows. `Use current location` reads the browser position through
`/api/geocode/reverse`. Destination asks for the city label; starting point asks for the exact
place and enables high-accuracy positioning, so it is as specific as a map pin. `Pick on map`
opens `LocationPickerDialog`, a mounted-only modal Leaflet map that places a pin,
reverse-geocodes the exact point, and fills the field only after a place is named. Suggestions,
current location, and the map all write a canonical label into the controlled text, and the map
picker returns focus to its field.

Step 02 collects a health profile that defaults to relaxation and stress recovery, budget,
transport, optional preferences, and the anonymous capture opt-in. The profile can be changed;
the label says it sets pacing ceilings, not a diagnosis. Budget is a three-stop slider over Value, Balanced, and Premium. The
review sentence and details line show the trip, party, transport, budget, and preferences. The
plan allowance sentence names the account's included live plans and day ceiling without
inventing a remaining count, and links to `/pricing`. The left column carries only the New trip
label and the headline; the right column is a 420px form on desktop and stacks below at 1024.
The draft helpers live in `lib/onboarding.ts` and are pure-tested. The persistent site footer
keeps the planning-aid notice and privacy/terms links; the onboarding column no longer repeats
it.

`PlanWorkspace` is the one-page result screen and live command surface. `CommandBar` carries
trip identity, stage, clocks, specialist progress, allowance, and Save trip / Edit trip /
Re-run plan; `WorkspaceSection` keeps the route, research deck, destination check, checked
places, pacing and safety, and activity rail mounted. `AgentTeamPanel` holds the seven-agent
deck and the planning signal graph; `AgentRoster` shows each agent's phase, role, and newest
message or activity line, and `AgentActivityFeed` turns the bounded log into a bar graph plus a
five-line ticker. `PlanPanel` shows the finished concierge plan, a designed route-forming
skeleton with an animated dashed route, or a calm retry that distinguishes a plan limit from a
failure. The safety section carries `CareCardButton` and `ItineraryBoard`; the destination check
carries `MissionControl`; checked places carry `VenueMissionControl`. The outcome form is a
collapsed "After your trip" disclosure inside the finished plan. Everything is mounted for the
whole page, so no stream aborts while the reader scrolls. `TripMap` receives `visible` and calls
`invalidateSize` when the page returns; a hidden page-level workspace also passes `visible=false`.

The page uses staggered section, deck, activity, signal, and marker motion. Every effect is
decorative and every animation is disabled under reduced motion. No phase renders the word
"Queued": the internal queued token reads as Starting for planner agents and Preparing for
TinyFish workers. The sister link is in the header from 640px and in the footer below. Gutters
are 24/40px; the footer sits 64px/96px below. The onboarding split is `1fr / 420px` with 80px
gap at 1024+; the workspace summary wraps its actions below the trip sentence. The page fits
375px without horizontal scroll, and controls stay at least 44px tall.

### Destination check

`PlanWorkspace` owns `useSwarm` and passes `state`, `runInput`, `retry`, and `rerun` to
`MissionControl`. The destination check is one calm surface with a pre-run row, one status card,
a "Watch live" disclosure, source-backed findings, a checked-date note, and a stale-input
caution. It shows no raw JSON, step count, tempo strip, provider internals, or invented partial
finding. The same worker state feeds the tightening overlay and the "Destination check" line in
the safety section.

`MISSION_WORKERS` names the single advisory worker and its host, `travel.gc.ca`.
`components/mission/Elapsed.tsx` owns the clock. The browser title is
`Checking destination - PlanMyTrip.health` while live, `Destination checked -
PlanMyTrip.health` when complete, and the plain title otherwise. A hidden `aria-live="polite"`
line announces only started, finished, and failed phase changes, at most once every three
seconds. `FocusView` shows the phase glyph, page name, elapsed time, source count, the current
purpose, a retry on failure, and an optional live iframe in a `referrerPolicy="no-referrer"` /
`sandbox="allow-scripts allow-same-origin"` frame. `PreRun` names the target host and what will
be checked; the raw goal is not exposed in the consumer view. `FindingsReveal` renders typed rows only after
COMPLETE, with provenance and retrieved time; `SourcesList` deduplicates by URL or title and
links with `noopener noreferrer`. `lib/swarmErrors.ts` maps every error code to calm copy and a
retryable flag.

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
ignored. `lib/swarmTelemetry.ts` derives elapsed time, connection health (`live`, `quiet` after
12s, `stalled` after 30s), the bounded merged feed, a summary (running, steps, sources,
findings), merged source rows, and staleness. `hooks/useSwarm.ts` batches stream actions through
`hooks/swarmBatch.ts` so a burst causes one reducer pass per animation frame. `hooks/useNow.ts`
ticks once a second only while a worker is queued or running; idle pages have no clock.

Worker events are accepted only from queued or running; `run_started` is the only exit from
idle. `streaming_url` accepts only https on `mock.invalid`, `*.unikraft.app`, or `*.tinyfish.io`
(VERIFY) in `lib/swarmState.ts` and `hooks/swarmFrames.ts`, plus the dev-only same-origin
`/mock-browser/<worker>` path; all other hosts are rejected. A live worker has a 280s client
budget inside a 300s route. If the SSE stream ends before COMPLETE, the runner polls
`GET /v1/runs/{id}` and uses the authoritative run record. A transient failure retries once, and
`/api/travel-swarm` declares `maxDuration = 300`. `swarm_done` stores completed and failed
lists. Any `mock: true` payload shows the "Sample result" caution; a live run clears it.

### Verification overlay

`lib/verificationOverlay.ts` is pure. `applyVerification(plan, {condition}, findings, options)`
returns a new plan and typed adjustments. It only tightens: an advisory heat, air-quality,
altitude, outbreak, or allergen match appends a bounded verified note to affected day
checkpoints, and a heat or air-quality match on a sensitive condition extends that day's
recovery block by 30 minutes, at most once per day. Step and walking ceilings, scores, and the
care card's planning notice never change. Unmatched, null, or "Not found" findings produce no
adjustment; a master switch and per-adjustment ids control what applies. Ids, order, and reason
text are deterministic, and reapplying the result is a no-op.

### KPI strip and paced itinerary

`ItineraryBoard` derives everything from `plan`; agent results never feed it directly, except
through the typed verification overlay. The KPI strip shows Pacing score (`/100`, baseline
compare bars), Daily step ceiling (`steps`), and Modeled risk reduction (`%`), both modeled
figures with a "Modeled estimate" sub-line and an input tooltip. It is three-up from 768px and
stacks below that width. A border-topped line reads
`Destination check: n of 1 source checked` and updates when the advisory returns findings. KPI
numbers tween over 300ms with `lib/planMotion.ts`; a changed value shows a hairline diff block
such as `Step ceiling 6,000 to 5,000 steps` for four seconds. `hooks/usePlanMotion.ts` owns the
tween and the four-second diff lifetime; reduced motion returns the final value immediately.

Each day is a hairline row, not a card: a 64px day number using `.t-metric-day`, title, caps,
and accent-soft checkpoint; a "How this day is modeled" disclosure holds the pacing rule, SVG
strip, and block list. A 160px column carries step and walk caps as stacked DataRows
(one-decimal km); mobile shows two columns. `.day-row` applies the global 240ms rise and 40ms
stagger; reduced motion disables both. A day with an applied recovery adjustment gets
`.anim-arrive`, an "Adjusted by the destination check" t-label, the
`Afternoon recovery 30 to 60 min` diff line, and the source link and retrieved time. The inline
SVG strip in `components/PacingStrip.tsx` has a 64px plot, an HTML 16px axis, ink bars at
`exertion / 3`, a hatched 12px recovery bar, and two-hour labels from 08:00. Exertion bars use
`transform: scaleY` from the bottom; recovery bars use `scaleX`; both transition over
`--dur-base` and stop under reduced motion. The block list is its text equivalent.

`CareCardButton` is the SectionHeader action. `buildCareCard` is pure and deterministic:
title, trip facts, blank line, `Daily checkpoints`, one
`Day <n> (step cap <n> steps): <checkpoint>` line per day, an optional
`Applied destination-check adjustments` section with each applied adjustment's source URL and
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
- **Consumer position:** the product speaks to travellers who want their health, energy, and
  budget to shape the trip. It is not a clinical service, a patient portal, or an insurance
  product. The health profile sets pacing ceilings; it never diagnoses, treats, or sells
  coverage. The landing, onboarding, and footer copy keep that boundary.
- **General relaxation default:** the health profile starts on "relaxation and stress
  recovery", a non-clinical general pace with a modeled 10,000-step / 6 km ceiling and a
  30-minute recovery. The traveler can change it to any supported condition profile. The
  interface says the profile sets ceilings rather than a diagnosis and never infers one from
  another answer. The draft normalizer still rejects an empty or unsupported profile.
- **One destination check:** a single TinyFish worker reads the Government of Canada advisory
  page for the destination. The product removed pharmacy, medication, and coverage workers, so
  there is no three-worker mission control, no provider JSON in the interface, and no coverage
  claim to verify. The check may add a verified note or lengthen recovery; it never widens a
  cap.
- **Venue-first evidence:** the concierge chooses and sequences places; TinyFish opens the
  selected menu or booking URL and returns checked facts. The venue deck and the plan's place
  rows show those facts with their source and checked time. Venue evidence is display-only and
  never changes the envelope, dose, health score, or cache identity.
- **Saved trips are account-owned, captures are anonymous:** `saved_trips` is scoped by
  `clerk_user_id` and stores a validated trip and plan snapshot. `trip_captures` remains
  consent-gated, keyed by the random install id, and never stores the Clerk user id. Deleting a
  saved trip never deletes a research capture. Account deletion removes account rows, then the
  Clerk user; anonymous captures stay separate by design.
- **Account deletion is explicit and ordered:** `POST /api/account/delete` requires a signed-in
  session, rejects a cross-origin browser request, deletes `saved_trips` and `billing_usage` in
  one transaction, and only then deletes the Clerk user. If the database cleanup fails, the
  Clerk account is left open so the traveler can retry. The shared cache is not account data.
- **Free safety, paid proof:** the safety envelope, caps, caution copy, and care card are free
  for every account. Care Circle sells the expensive proof and capacity: the live destination
  check, live venue menus and rates, 20-day trips, two live plans a month, and unlimited saved
  trips. The free tier is one live 7-day plan a year and one saved trip. Every gate is enforced
  in a server route, not only in the client.
- **Clerk Billing, not a local billing table:** the active plan and features come from the
  Clerk session; `billing_usage` is the fair-use reservation log. `/account` delegates payment
  method, invoice, cancellation, and plan switching to `UserProfile`. Billing webhooks are not
  required for access and are not implemented yet.
- **Reservations fail closed:** a live plan reserves its allowance in one transaction with an
  advisory lock over the account, metric, and period. A limit refusal returns `trip_limit`; a
  database failure returns 503 instead of granting an unmetered run. The server generates the
  usage event id, so a client run id cannot manufacture or reuse usage. Cached and mock runs
  never reserve.
- **Live limits are in memory and single-instance:** `lib/concurrency.ts` and `lib/rateLimit.ts`
  hold per-account and global leases, cooldowns, the venue UTC-day cap, and the geocoder
  per-minute budget in process state. One live run per account is always enforced; the
  configured global caps default to planner 2, destination 3, and venue 2. A process restart
  clears them, and a multi-instance deployment would need a shared store.
- **Account chrome uses full navigation:** the brand lockup, header, footer, model-page, and
  saved-trip account links are native anchors, not client `Link` transitions. A stale client
  router must never trap a pricing, sign-in, or saved-trip click; the page reloads cleanly.
  `LinkButton` detects an internal `href` (`/` or `#`) and keeps it in the same tab even when
  the default `external` prop is true. Header link hit areas are padded and carry their own
  stacking context.
- **Fair launch price, annual-first:** the research target was $79/year, but the shipped launch
  price is $9/month or $60/year to stay fair for individual travellers. Clerk's
  monthly-equivalent field produces $60/year. The production instance does not have the
  annual-only update enabled, so the $9 monthly option is visible as a flexibility option.
  Enable the update and set the monthly amount to zero to remove it.
- **Scaffold in place:** `.git` and a user-owned `README.md` existed; the README is untouched.
  Generated `cacheComponents` and `partialPrefetching` were removed.
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
- **PostgreSQL, not SQLite:** `pg` with a parameterized pool is the cache, saved-trip,
  reservation, capture, and model-run store. `saved_trips` carries the account-owned snapshot;
  `billing_usage` carries one usage event per live plan and allowance period; `trip_captures`
  and `model_runs` carry the anonymous research loop; `trip_cache` carries both cache tiers.
  The schema is idempotent and applied by `npm run db:init`; production, development, and tests
  use separate databases. Per-statement and per-query timeouts stop a hung query from pinning a
  pool client or an SSE stream. No SQLite file or binary demo database is committed. Best-effort
  writes wait at most two seconds before the SSE stream closes.
- **Computed dose, not self-report:** the concierge's `stepEstimate` is an agent claim. Every
  training row is computed from block kind, duration, exertion, and verified hike elevation,
  so live and fallback plans yield comparable doses. A displayed day is inside its cap only
  when the agent estimate and the computed dose both fit; an empty day is unsafe, not zero.
- **Cache results, not progress:** a cached destination replays completed planner and
  destination results in about a second. Frames keep the real event contract and carry
  `cached: true`; no percentage, ETA, or fake step is added. A planner cache key includes the
  preference set, check-in date, and party size; the related fallback must match the date and
  party too. A destination-check key requires every requested worker. Mock data is never
  cached, cache writes never block a live result, and the cached plan is a snapshot, not a live
  recheck.
- **Cached plans never create dossiers:** only a live `plan_ready` writes a consented research
  dossier. A cache replay has no fresh consent signal and must not add a duplicate or stale
  training row; the planner route skips capture when the cache produced the plan.
- **No recording archive:** the recording experiment was removed. `/api/recordings`,
  `lib/cache/recordings.ts`, `swarmArchive.ts`, `CachedRecordings`, and the recording
  environment variables are gone. TinyFish is never asked for a video, and the live preview is
  the page itself, not a recording. Any existing files and production env values are operator
  cleanup, not an app feature.
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
  Do not bring back conditional tab panels or unmount the destination check or checked places
  while the plan forms.
- **Collapse by relevance, never by unmount:** `WorkspaceSection` opens the surface carrying
  the live work and collapses settled surfaces to a real summary. A reader can reopen any
  section. Closed bodies stay mounted and inert, so a collapse never aborts a stream. The
  activity feeds show only the newest lines; history is one disclosure away.
- **Route is derived, not re-planned:** `lib/route/` projects the finished plan into an order
  and a Maps link. It may reorder stops inside a day and pin meals, but it never moves a place
  to another day, so the plan, the dose, and the dossier stay identical. Transport changes
  movement and time, never a condition ceiling. Cross-day rebalancing needs its own
  capture-aware step.
- **TinyFish extracts venue facts:** the concierge discovers and sequences places; TinyFish
  opens the selected menu or booking URL and returns structured facts with a source and checked
  time. A venue pass uses at most five pages, three browsers at a time, no recording, and a
  fallback from the preferred URL to the plan source page. Venue evidence is display-only: it
  never changes a cap, the dose, or the health score.
- **Only public venue URLs reach TinyFish:** `lib/venue/url.ts` rejects non-http(s), loopback,
  private, link-local, unique-local, multicast, reserved, and single-label hosts before a
  browser job starts. The check is syntactic and performs no DNS lookup, so it does not catch
  DNS rebinding; the provider's network boundary remains part of the control.
- **Venue cache is separate and place-scoped:** the v2 key includes the place id as well as the
  URL (and dates plus party for hotels), so a shared city listing cannot collide across two
  restaurants. Menus freshen for 7 days and rates for 12 hours; cached frames replay real
  recorded sources and activity offsets, never invented progress.
- **Privacy and terms are product surfaces:** `/privacy` and `/terms` are public pages linked
  from the footer. They describe the account, anonymous research, live checks, geocoding,
  feedback, and operational logs in plain language. Legal review is still required before a
  paid pilot.
- **Public landing, private planner:** `/` shows the landing page to a signed-out visitor and
  `PlannerHome` to a signed-in one. Planning, saved trips, and the workspace still require
  Clerk. The landing uses real captures of this app with the London sample trip; they are the
  only raster assets, never stock photography, and are confined to
  `components/landing/ProductShot.tsx` under a narrow guard exception.
- **One brand mark:** a pin and pulse read as travel and health. The inline SVG is the header,
  sign-in, sign-up, footer, and watermark; `app/icon.svg` and `app/apple-icon.png` are the
  favicon and touch icon. No second logo direction.
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
`animate-spin|ping|pulse|bounce`, `transition-all`, emoji, flags, images except the real
product captures in `components/landing/ProductShot.tsx`, and banned marketing copy. A separate
motion guard requires all six named motion classes and a reduced-motion block that switches
them off. `design-guard-ignore` exempts a line. Twenty-two banned and five allowed fixtures
prove the rules. `tests/contrast.test.ts` checks 13 pairs at 4.5:1 or better.

### House destination advertisements

`components/ads/DestinationAd.tsx` renders first-party house advertisements in three
layouts: a landing poster, a site-footer strip, and an inline card. The footer strip is in
`SiteFooter`, so every page that carries the closing notice also carries one labelled ad.
Prominent placements are the landing poster, the pricing inline card, the saved-trip list
inline card, every saved-trip report, the workspace report, the account page, privacy, terms,
the model report, and the sign-in and sign-up strips. Every public page now carries at least
one labelled ad; the error boundaries, the dev-only mock browser, and the static pitch deck
remain ad-free.

Copy lives in `lib/ads/campaign.ts`. `plan` campaigns ask for a trip start; `upgrade`
campaigns sell Care Circle and link to `/pricing`; `context="report"` swaps in copy written
for a finished report ("Make this Paris report current" or "Plan another Paris trip"). A city
note is used only when the destination's country matches the note's country, so "Paris, Texas"
never borrows the Seine copy. Every destination gets the city name and the generic health-trip
copy; no ad reads a health profile. `.ad-poster-city` in `globals.css` is campaign-only display
type, not a general type class.

The destination order is the current trip, then the last built destination in
`localStorage` (`planmytrip.adDestination`), then the browser time zone, then a rotating
featured city. No geolocation permission is requested and no inferred time zone is stored.
The plan CTA opens the prefilled planner for a signed-in reader
(`/?destination=<city>`) or sign-up with that planner path as the return for a visitor.

Clicks are beacons to `POST /api/ads/click`. The route writes one JSONL row per click to
`PLANMYTRIP_ADS_DIR` with destination, placement, campaign intent, layout, and CTA target.
It stores no account id, IP address, health field, or free text; the IP is used only for an
in-memory rate limit. Run `npm run ads:report` to print the aggregate counts. The privacy
notice describes the local destination and the aggregate click count. Ad anchors also carry
`data-cta` (`ad_plan`, `ad_care_circle`, or `ad_plans`) and `data-surface` so the first-party
CTA analytics funnel can attribute sign-up and checkout conversion to a placement.

### Conversion analytics

`lib/analytics.ts` is the only analytics client. It loads PostHog after the page is idle or
after the first pointer, key, or scroll event, and never before. `initAnalytics` respects Do
Not Track and Global Privacy Control, disables autocapture, session recording, exception and
heatmap capture, and sends only allowlisted event names and properties. `AnalyticsPageview`
and `AnalyticsAuth` live in the root layout; `CheckoutAnalytics` marks a completed checkout on
`/pricing`. Public paths map to `/`, `/pricing`, `/privacy`, `/terms`, `/sign-in`, `/sign-up`;
account, saved-trip, and workspace paths map to `/app`.

The event vocabulary covers pageviews, scroll depth, CTA clicks, `ad_clicked`,
`plan_build_started`, `trip_saved`, `feedback_opened`, `feedback_submitted`, `checkout_success`,
and the auth completion events. Ad anchors carry `data-cta` and `data-surface`, so the funnel
can connect an ad placement to sign-up, plan build, saved trip, and checkout without putting a
destination, health field, account id, email, or free text in an event. The privacy notice
documents the PostHog browser identifier, the disabled recording, and the DNT/GPC behavior.

## 8. Medical safety rules

- The product is a planning aid, not medical advice. The persistent footer reads: "Planning
  aid only. Not medical advice. Confirm health and travel insurance details before you travel."
  The product does not diagnose, treat, sell insurance, or tell anyone to take or change a
  medication.
- All physiological thresholds live in one typed `CONDITION_PROFILES` constant in
  `lib/conditionProfiles.ts`, each with a rationale, a modeled residual-risk floor, and a
  `// VERIFY:` flag. No magic numbers elsewhere.
- `healthSafetyScore` and `riskReductionPct` are deterministic modeled estimates from the
  documented formula. Label them "Modeled estimate" with an input tooltip. Never call them
  measured or clinically validated.
- The calibration model is a planning-aid estimate. Show "Modeled estimate" until a real-data
  artifact reaches the pooled tier; never present synthetic output as clinical evidence. The
  model may only tighten a cap, never widen it above the profile ceiling.
- The concierge is a planning aid. Every day carries the engine's step and walking ceiling,
  recovery minutes, and checkpoint. Agent estimates are labelled as estimates; a day above a
  ceiling, including a day whose block dose exceeds the ceiling while its estimate does not,
  shows a caution and the Pacing limit always wins.
- The destination check only tightens. It may add a verified note or extend recovery; it never
  raises a step cap, walking cap, score, or risk reduction. Venue menus, rates, and allergen
  notes are the page's own words, not a clinical guarantee.
- The post-trip label requires an explicit flare answer; an untouched control is never saved
  as a negative. The public outcome route ignores free text. The research capture is keyed by
  the anonymous install id; Clerk account identity is stored only on saved trips and account
  deletion.
- Agent findings show the source URL and retrieved time. Missing fields show "Not found",
  never a guess. Malformed JSON shows the raw text plus a parse error.
- Geocoded coordinates are labelled approximate. A place without a verified or geocoded
  coordinate is not plotted; the itinerary list remains the source of truth.

## 9. VERIFY register

Regenerate with `grep -rn "VERIFY:" app lib components`; there are 24 code markers.
Five product-review rows do not carry a marker yet: destination goal, live limits, venue URL,
cache identity, and account deletion.

| File | What to verify |
| --- | --- |
| `lib/conditionProfiles.ts` (general) | floor 10; 10,000-step ceiling, 6.0 km walking, 30-minute recovery, altitude, heat, and personal allergens against general travel guidance. This is a non-clinical default; confirm it cannot be mistaken for a fitness or medical assessment. |
| `lib/conditionProfiles.ts` (asthma) | floor 22; 7,000-step ceiling, 4.0 km walking, 30-minute recovery, altitude, heat, and allergens against respiratory guidance. |
| `lib/conditionProfiles.ts` (POTS) | floor 25; 4,000-step ceiling, 2.5 km walking, 90-minute recovery, altitude, heat, and allergens against autonomic guidance. |
| `lib/conditionProfiles.ts` (pregnancy) | floor 18; 5,000-step ceiling, 3.0 km walking, 45-minute recovery, altitude, heat, and food safety against maternity guidance. |
| `lib/conditionProfiles.ts` (food allergy) | floor 20; 6,000-step ceiling, 3.5 km walking, 30-minute optional recovery, heat, and allergens against allergy guidance. |
| `lib/conditionProfiles.ts` (cardiac) | floor 22; 5,000-step ceiling, 3.0 km walking, 45-minute recovery, altitude, heat, and sodium/allergens against cardiology guidance. |
| `lib/swarmState.ts` (preview allowlist) | Docs list `*.unikraft.app`; a live production run on 2026-11-21 returned `*.tetra-data.production.tinyfish.io`, so both provider domains are allowlisted. Recheck if TinyFish introduces another host family. |
| `lib/swarmConfig.ts` (limits) | Custom `max_steps` is beta-gated on this account and returns 403 FORBIDDEN, so it must stay omitted. Confirm `max_duration_seconds: 100` and `cursor_style: "standard"` are accepted and one worker fits the 280s client/300s route budget after queue delay; the provider default is 150 steps. |
| `lib/swarmRunner.ts` (stealth retry) | Confirm a `SITE_BLOCKED` retry with `browser_profile: "stealth"` is accepted, does not double-bill, and does not repeat a side effect. |
| `lib/swarmGoals.ts` (destination goal) | Confirm the Government of Canada advisory page is the right single source, that the goal asks only for what the page states, and that the condition context does not become medical advice. |
| `lib/tinyfishEvents.ts` (TF_API_RESULT) | The provider documents an array but not its item shape. This build reads only direct string `url` and `title`; confirm the real shape on a live run before widening it. |
| `lib/verificationOverlay.ts` (keyword rules) | Heat, air-quality, altitude, outbreak, and allergen keywords are product heuristics, not clinical thresholds. Have a clinician confirm the mapping and the 30-minute recovery extension. |
| `lib/liveLimits.ts` (limits) | Planner 2, destination 3, and venue 2 global runs; 15s/15s/30s cooldowns; 8 venue passes per UTC day; 60 geocoder requests per minute. Confirm these suit real traffic and cost, and move the in-memory state to a shared store before running more than one instance. |
| `lib/venue/url.ts` (URL gate) | The gate is syntactic: it rejects private literal hosts but performs no DNS lookup. Confirm the provider's network boundary also blocks rebinding and redirects before a public pilot. |
| `lib/cache/cacheKey.ts` (date and party) | A related plan cache row must match check-in and travellers; confirm old rows without the signature are a miss, not a wrong stay. |
| `lib/db/account.ts` (deletion and retention) | Confirm deleting `saved_trips` and `billing_usage`, then the Clerk user, is the intended order; confirm backups and anonymous captures have a documented retention/deletion answer. |
| `lib/agent/agentGeocode.ts` (Nominatim) | Public Nominatim allows one request per second and requires an identifying User-Agent. Confirm the production geocoder's licence, quota, and attribution. |
| `lib/agent/agentGeocode.ts` (fallback) | The optional fallback uses Photon's public demo API in production today. Confirm its licence, quota, attribution, and data-retention terms, or point `GEOCODER_FALLBACK_URL` at a licensed GeoJSON provider. |
| `lib/geocode/search.ts` (autocomplete) | The onboarding search and reverse routes use the same Photon endpoints. Confirm the search quota, attribution, cache policy, and the permission copy for current location before a paid launch. |
| `lib/mapTiles.ts` (tiles) | Confirm the production tile licence, attribution text, and request volume for both the route map and the location picker. Public OSM tiles are not a high-volume production endpoint. |
| `lib/data/dose.ts` (block exertion) | The block-kind to exertion mapping and hike thresholds (8 km, 350 m, hard/strenuous) are product assumptions, not clinical thresholds. Have a clinician confirm the walking contribution of visits, transit, and care blocks. |
| `lib/data/dose.ts` (recovery) | Recovery coverage counts only `rest` blocks. Confirm that meals, stay, and unplanned pauses should not count as recovery. |
| `lib/route/legs.ts` (speeds) | 4.5 km/h walking, 18 km/h urban transit, 32 km/h driving, and the access and parking overheads are product assumptions. Confirm them for the destinations this product serves. |
| `lib/route/mapsLink.ts` (Maps URLs) | Nine waypoints and the `walking`/`transit`/`driving` values against Google's Maps URLs reference; confirm the terms permit this deep-link handoff. |
| `lib/venue/runner.ts` (limits) | 75s job, 45s recovery, 255s run budget, three concurrent browsers, and `max_duration_seconds: 90` against current TinyFish limits and billing; confirm one venue pass fits the 300s route. |
| `lib/venue/goals.ts` (schemas) | The menu and hotel schemas use only object, array, string, number, and nullable fields with every property required; confirm against the provider's structured-output rules. |
| `lib/cache/venueCache.ts` (TTL) | Seven-day menu and twelve-hour room-rate freshness are product choices; revisit them with measured venue change rates and provider retention terms. |
| `lib/model/model.json` (artifact) | The committed artifact is trained on synthetic trips. Never use it for a live plan. Replace it only with an artifact whose `source` is `outcomes` and whose tier is `pooled` or `condition`. |
| `docs/MODEL_CARD.md` (metrics) | Regenerate after every training run; confirm Brier, ECE, AUROC, and the calibration slope match `lib/model/model.json`. |

## 10. External integrations

Clerk: the app uses `@clerk/nextjs` 7.10.7 against production application
`app_3MR7sJ2fhslkGXYl4yRqjseO13C`. `ClerkProvider` sits inside `<body>`; required sign-in uses
`/sign-in` and `/sign-up` with relative redirects, so the public host survives nginx. A
signed-out `/` renders the public landing page in place; it does not redirect. `/trips`,
`/trips/[id]`, and `/account` redirect through `signInHref`, which validates the return path so
a signed-in shopper lands back on the page they chose. `/privacy` and `/terms` are public. The
production domain `planmytrip.health` is configured with `proxy_url:
https://planmytrip.health/__clerk`; `clerkMiddleware` handles the Frontend API proxy.
`POST /api/account/delete` removes account-owned rows, then the Clerk user; the request is
same-origin only.
`proxy.ts` wraps the middleware and forwards only `x-clerk-*` request headers. Next 16.4.6
hangs when Clerk's full request-header override set (including `host` and `connection`) is
returned; the filter is load-bearing. Clerk's Dashboard sign-in is not CLI authentication;
run `npx -y clerk@latest auth login` on the host before changing account-level settings.

Clerk Billing: production has `free_user` ("Free Preview") and `care_circle`
("Care Circle", $9/month or $60/year). Annual is the intended plan. The instance is not
opted into the separate annual-only update, so monthly remains visible; set `amount: 0` in
`scripts/clerk-billing.json` and re-apply after enabling it. `lib/billing/plans.ts` maps
`long_trips`, `live_verification`, `venue_research`, and `saved_trips_unlimited` to product
limits. The `live_verification` feature is named "Live destination check" in the applied Clerk
catalog and covers the advisory check plus the live venue layer; `venue_research` is named
"Live menus and room rates". `/pricing` renders `PricingTable`, `/account` renders
`UserProfile`, and every paid route checks `auth().has()` before work. Live planner runs are
reserved in `billing_usage` by allowance period; a cache hit never reserves. Clerk Billing is
recurring-only, USD-only, has no tax/3DS/refunds, and adds 0.7% plus Stripe fees. The full
catalog and commands are in `docs/BILLING.md`.

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

Venue research is the third SSE contract. Every frame carries `worker`, a monotonic per-worker
`seq`, `ts`, and optional `cached`; `venue_done` is always last.

| Event | Fields | When |
| --- | --- | --- |
| `venue_started` | `workers` (id, name, category, kind, sourceUrl) | Once before the browser jobs. |
| `venue_status` | `status`, `message?` | Preparing, reading, checked, or failed. |
| `venue_activity` | `kind`, `text`, `offsetSec?` | One accepted search, read, note, or note/error line. |
| `venue_streaming_url` | `streamingUrl` | A live TinyFish preview URL arrives. |
| `venue_sources` | `items: [{url?, title?, api}]` | The source ledger grows, including the checked page. |
| `venue_result` | `evidence` | One validated menu or hotel snapshot. |
| `venue_error` | `code`, `message` | Missing key, timeout, blocked, invalid input, or upstream. |
| `venue_done` | `completed`, `failed`, `summary` | Once after every venue run. |

Headers are the same SSE set; `/api/venue-research` declares `maxDuration = 300`, requires
Clerk auth, and validates the body before it touches TinyFish. Cached replays keep the real
recorded activity, sources, and evidence, and carry `cached: true`.

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
default is 150 steps. The limits live in `lib/swarmConfig.ts` and keep one advisory worker
inside the 280s client budget and 300s route. No `capture_config`, recording request, or
`video_url` read remains; `lib/tinyfishRuns.ts` now only recovers the authoritative run record.
Venue passes use `maxDurationSeconds: 90` and their own budget in `lib/venue/runner.ts`.

Upstream `data: <json>` events: `STARTED` (run_id), `STREAMING_URL`, `PROGRESS`
(purpose, optional tinyfish_api), `HEARTBEAT`, `COMPLETE` (status/result/error), and optional
`TF_API_RESULT` (tinyfish_api, result array). Unknown types are counted and ignored;
`COMPLETE.result` is authoritative. The route forwards absolute http(s) STREAMING_URL values;
the browser keeps only https `mock.invalid`, `*.unikraft.app`, or `*.tinyfish.io` previews, plus
the dev-only same-origin `/mock-browser/<worker>` path. On HTTP 400 `INVALID_INPUT` the worker
retries once without `output_schema`; on `SITE_BLOCKED` it retries once with
`browser_profile: "stealth"`. Each retry emits a `worker_note` with calm copy.

Destination-check frames all carry `worker`, a monotonic per-worker `seq`, an ISO `ts`, and
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
`COMPLETE` is reconciled through `GET /v1/runs/{id}`; transient failures retry once, and a
failure settles the check without leaving the stream open.

Mock mode needs no key or network; every payload carries `mock: true`, preview URLs use the
dev-only `/mock-browser/<worker>` page, and the timeline is seeded. `SWARM_MOCK_SPEED`
multiplies the scripted clock (tests use 50); `SWARM_MOCK_FAIL=<worker>` makes that worker fail
with `site_blocked`:

```bash
SWARM_MOCK=1 SWARM_MOCK_SPEED=50 npm run dev
curl -N -X POST http://localhost:3000/api/travel-swarm \
  -H 'Content-Type: application/json' \
  -d '{"destination":"Lisbon, Portugal","condition":"asthma_respiratory"}'
```

One live destination run drives one real browser; a venue pass can open up to five. Never call
either in tests or routine development.
Docs: <https://docs.tinyfish.ai/tinyagent/api/agent/endpoints.md>,
<https://docs.tinyfish.ai/api-reference/automation/run-browser-automation-with-sse-streaming.md>,
<https://docs.tinyfish.ai/live-preview.md>,
<https://docs.tinyfish.ai/tinyagent/api/agent/structured-output.md>.

## 11. Testing

`npm test` runs Vitest once in a Node environment. The suite has 702 tests: 663 pass and 39
skip without `DATABASE_URL`. Database-backed files skip when `DATABASE_URL` is
absent. `tests/mocks/clerk-server.ts` replaces
`@clerk/nextjs/server` in Vitest so route handlers can run outside Next's server boundary;
proxy and Clerk provider behavior are covered by a production build and live request checks,
not by the unit suite.

- `tests/design-guard.test.ts` and `tests/contrast.test.ts` guard styles and 13 WCAG AA token
  pairs; `tests/smoke.test.ts` covers the general profile plus the five condition profiles.
- `lib/healthTripEngine*.test.ts` covers every condition x 2-20 days, caps, invariants,
  recovery, scores, determinism, validation, docs, and re-exports. Shared input is
  in `tests/healthTripFixtures.ts`.
- `lib/tinyfish*.test.ts`, `lib/swarmGoals.test.ts`, `lib/swarmTypes.test.ts`,
  `tests/swarm-route*.test.ts`, and `tests/swarm-runner.test.ts` cover parsing, mapping,
  schemas, normalisation, bounded upstream text, request bounds, missing key, isolation,
  retries, mock, timeout, abort, and swarm_done. All network is mocked.
- `tests/swarm-recovery.test.ts` proves a stream that ends after STARTED recovers the
  authoritative COMPLETED run record, a recovered FAILED result retries once and then
  completes, and two failures produce one final error.
- `lib/redirects.test.ts` proves a return path stays on this origin and rejects absolute,
  protocol-relative, backslash, control-character, and overlong values.
- `lib/rateLimit.test.ts` and `lib/concurrency.test.ts` cover fixed and UTC-day budgets, zero
  limits, reset, one run per account, global caps, cooldowns, and idempotent release.
  `tests/live-guards.test.ts` proves the kill switch returns 503 on every live surface, a
  closed billing database returns 503, the planner and venue cooldowns return 429, and the
  venue daily cap holds after the cooldown passes.
- `lib/ops/pendingWrites.test.ts` proves best-effort writes settle or time out without holding
  the stream. `lib/venue/url.test.ts` proves non-http, loopback, private, link-local,
  multicast, reserved, single-label, and malformed URLs are rejected.
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
  normalised keys, exact and related planner reads, date and party matching, expiry, mock
  rejection, complete-set destination-check reads, recorded telemetry replay, terminal-frame
  order, a full route cache hit with no live session, and PostgreSQL exact/related and
  worker-set reads. The database file skips without `DATABASE_URL`.
- `tests/agent-capture.test.ts` proves a cached plan replay does not create a research dossier;
  the same file covers consent gating and the computed dose.
- `lib/venue/*.test.ts`, `hooks/venueFrames.test.ts`, `lib/cache/venueCache.test.ts`, and
  `tests/venue-route.test.ts` cover menu and hotel request bounds, evidence normalisation,
  price and date rules, public URL validation, grouping and checked stamps, reducer
  transitions, recorded activity offsets, cache collisions on a shared listing URL, legacy
  evidence rows, fallback to the plan source page, preview URL rejection, and the authenticated
  venue SSE route.
- `lib/savedTrips.test.ts` covers saved-trip request bounds, normalisation, mock-plan rejection,
  and saved-trip id validation. `lib/db/savedTrips.test.ts` covers account-scoped upsert,
  list, read, delete, and cross-account isolation; it skips without `DATABASE_URL`. Route
  handlers require a Clerk user through the shared auth check and never touch data signed out.
- `lib/billing/plans.test.ts` covers free fallback, Care Circle feature mapping, paid plan
  detection, missing-feature caps, a throwing `has()`, and monthly/yearly allowance starts.
  `tests/billing-gates.test.ts` exercises the free-plan 403 responses for a 20-day trip,
  the live destination check, and venue research. `lib/db/billingUsage.test.ts` covers the
  atomic reservation, limit refusal, server-generated event ids, and cross-user isolation; it
  skips without `DATABASE_URL`. The billing tests never call Clerk or Stripe.
- `lib/data/*.test.ts`, `lib/db/trips.test.ts`, and `lib/model/*.test.ts` cover computed dose,
  empty and over-cap days, block-level cap reconciliation, hike exertion, dossier and outcome
  parsing, free-text rejection, isotonic monotonicity, coefficient recovery, grouped folds,
  nested calibration, artifact validation, tier gating, PostgreSQL upserts, install scoping,
  cached-plan capture exclusion, mock and stale-row export filters, and training export.
- `tests/model-artifact.test.ts` proves the committed cohort, artifact, and model card are
  reproducible and that no live API, capture, or planning module imports the model; it also
  checks the documented ship gate. `lib/model/artifact.test.ts` proves malformed, stale, or
  zero-row artifacts fall back to the engine.
- `tests/agent-capture.test.ts`, `tests/swarm-capture.test.ts`, `tests/outcome-route.test.ts`,
  `tests/data-loop.test.ts`, and `lib/db/account.test.ts` run the real routes and repository
  against PostgreSQL: consent gating, cached-plan exclusion, computed dose, destination stub
  creation, explicit label storage, wrong-install 404, account-scoped deletion, and capture to
  outcome to export to training to prediction. These files skip when `DATABASE_URL` is absent;
  `vitest` runs files sequentially so schema truncation cannot race across files.
  `tests/account-delete-route.test.ts` proves the deletion route removes account rows before
  Clerk, rejects a cross-origin request, and does not close the account when cleanup fails.

Add pure-function tests beside the module or under `tests/`, named `*.test.ts`; Vitest includes
`**/*.test.ts`. No component-test libraries. Mock fetch in route and SSE tests; never call the
live planner or TinyFish from an automated check. Keep the design guard green rather than
exempting lines.

## 12. Known limitations and open questions

- The general relaxation profile is a non-clinical default. Its 10,000-step / 6 km ceilings, 30-minute recovery, and 10/100 residual-risk floor are product assumptions, not a fitness or medical assessment. Confirm them with clinician and traveler feedback before presenting the default as a personal limit.
- The live limits are in-memory and single-instance. A process restart clears active leases,
  cooldowns, the venue UTC-day count, and the geocoder minute window. A multi-instance
  deployment needs a shared store before it can trust these caps.
- Venue URL validation is syntactic. It rejects literal private hosts and non-http(s) schemes
  but performs no DNS resolution, so a DNS-rebinding or redirect target is outside its check.
  Confirm the provider's network boundary before treating it as a security control.
- The database-backed reservation and account-deletion tests have not been run against a real
  PostgreSQL instance in this docs branch. Run `npm run db:init` and the database suite against
  staging before launch; an untested advisory lock or deletion transaction is not proof.
- `/privacy` and `/terms` are drafted from the shipped data flows and need legal review before
  a paid pilot. Coverage includes Clerk, OpenCode, TinyFish, Photon/Nominatim, map tiles,
  Google Maps handoff, local feedback JSONL, and operational error reports.
- Anonymous research captures are not linked to the Clerk account, so account deletion cannot
  remove them. The privacy page explains this and tells the reader to clear local storage or
  contact support. A retention and deletion path for captures is still required.
- The recording files and `TINYFISH_RECORDING` / `PLANMYTRIP_RECORDINGS_DIR` values were
  removed from production on 2026-11-25. The app no longer reads either variable, serves
  `/api/recordings`, or archives a video.
- Saved-trip pagination has no total count. `/trips` reads one sentinel row to offer Older and
  Newer, so the page says "Page n" without a total and an empty page can only link back.
- A full live 7-agent planner pass plus the single destination check has not been run together
  since the consumer reset. Earlier live runs completed specialist subsets; run one production
  pass and record the exact completed/failed agents before calling the planner proven.
- Live TinyFish destination runs were verified before the reset: the key, progress events, and
  preview URL worked, and the preview host was `*.tinyfish.io`. The current single-worker
  destination flow is covered by mocked tests; confirm a real advisory run, the 280s budget,
  the stealth retry, and a forced stream drop on the deployed build.
- The route tolerates unknown events, stringified `result` values, and partial payloads.
- The preview allowlist covers `mock.invalid`, `*.unikraft.app` (docs), and `*.tinyfish.io`
  (verified live 2026-11-21).
- The default free model hit a provider quota during development; production must set
  `OPENCODE_MODEL`. A quota failure maps to `agent_unavailable`.
- The runtime warmup runs at server start, so a normal first trip does not pay service and
  agent-registration latency. A production 4-day run before the reset reached plan ready in
  about six minutes with all seven specialists; a London seed took about seven minutes and an
  exact cache hit returned in 269 ms. If the OpenCode service itself is still starting, the
  first request still waits; the command bar names the stage but cannot shorten it.
- Trips are supported from 2 to 20 days. The modeled trip-length pressure saturates at seven
  days, so an 8-20 day trip carries the same length pressure as a seven-day trip rather than a
  new, unvalidated curve. The daily pacing factors stay the same for every middle day; a
  clinician should review cumulative load and rest-day spacing before a long-trip pilot. The
  synthetic model cohort was trained on shorter trips, so long-trip predictions are an
  extrapolation.
- The workspace is intentionally one long page. On a phone, the destination check and checked
  places sit below the route; every live surface keeps running while the reader scrolls. Do not
  reintroduce tabs to shorten it.
- The KPI tween and four-second diff chip are wired to a plan prop change, but Edit trip
  remounts the workspace by design, so the current single-page flow does not exercise the chip
  in the browser. The math and lifetime are unit-tested; an in-place plan update will show it.
- The embedded `@opencode/sdk` host requires Node 26 for `await using`; this app is on Node 22
  and uses `@opencode/client` against a running OpenCode service. A production deployment must
  provide and supervise that service. Production runs the CLI from `/usr/local/bin` and keeps
  its managed port on 49375 because the interactive root service owns 49374; the Go key and
  model live in `/etc/planmytrip.env`, not the repo.
- Geocoding is covered by mocked fetch tests; the live Nominatim pass has not been exercised
  against a real agent plan. Public OSM tiles and Nominatim are not production-scale endpoints.
- Saved snapshots do not include destination findings, menus, or room rates, and they do not
  refresh source URLs or opening hours. The saved page rebuilds the engine envelope, labels the
  snapshot, and offers an explicit "Refresh menus and rates" action. Confirm live details before
  booking.
- Cached plans and destination checks are snapshots with a date, not a live recheck. A planner
  hit can be an exact preference match or a same-destination related match, but only when the
  check-in date and party size also match. The cache has no per-destination purge UI; rows
  expire after 30 days (plan) or 14 days (destination check), and `npm run cache:seed` can
  replace a demo row.
- Venue evidence loads after `plan_ready` and does not yet feed the concierge before it
  chooses places. A hotel with no rate or a restaurant with no priced menu cannot cause the
  planner to choose a different place. Routing a bounded evidence summary into a later
  synthesis or re-rank step is the next product move.
- The TinyFish venue preview redirects to the provider's `tetra-streaming.tinyfish.io` DevTools
  inspector. It is a live page, not a recording. Headless screenshot tooling showed the
  inspector surface as blank while the remote page target was attached; a normal browser is
  the acceptance check.
- Venue cache rows are keyed by kind, URL, place id, and for hotels the dates and party, so a
  shared city listing cannot collide across restaurants. Menus expire after 7 days and rates
  after 12 hours; there is no purge UI yet. A re-run refreshes only the missing or failed
  pages and returns cached facts immediately. Venue evidence is not stored in a saved trip
  snapshot.
- A full venue pass can open up to five real browsers. `lib/liveLimits.ts` now enforces one
  pass per account, two globally, a 30-second cooldown, and eight passes per UTC day by
  default; confirm those fair-use values and the TinyFish bill before a public pilot.
- Location autocomplete, current location, and the map picker depend on browser permission
  and the configured geocoder. A denied permission or a provider outage leaves the typed city
  usable; the UI never fills an unverified place. Destination current location resolves to a
  city; starting point asks for the exact place and requests high-accuracy positioning. A
  desktop browser without GPS can still be approximate, so the map picker remains the precise
  fallback. The map pin becomes a destination label, not a stored coordinate; the itinerary
  still derives venue points from verified research. Production currently uses Photon's public
  endpoint; confirm its quota, attribution, and retention terms, and verify the permission copy
  with real users before a pilot.
- Consent and privacy: the destination, health profile, preferences, dates, and party size are
  sent to the configured OpenCode model provider. A destination check sends the destination and
  health profile to TinyFish; venue checks send the selected menu or booking URL, dates, and
  party size. Place queries and a current-location coordinate go to the configured geocoder
  (Nominatim or Photon). Account identity and sessions are handled by Clerk. The research
  capture is opt-in and keyed only by a random localStorage install id; saved trips are
  separately account-owned and account deletion removes only that account data.
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
- Clerk provides authentication; the app now has per-account live-run and geocoder limits, but
  no general request rate limit at the proxy. PostgreSQL runs on the host; a production
  deployment still needs backups, access control, monitoring, and a documented retention
  policy. Account deletion removes `saved_trips` and `billing_usage`; confirm backups and
  anonymous captures separately.
- The production Clerk custom domain is routed through the same-origin proxy, not the
  `clerk.planmytrip.health` CNAME. The Dashboard domain's required CNAME records for email and
  account portal may still be pending; confirm DNS and sign-in methods after the first user
  signs up. The Clerk CLI session is root-only and can expire; re-run `auth login` before
  account-level config commands.
- Care Circle is $9/month or $60/year because Clerk's annual-only update is not enabled.
  The one-time $29 Trip Pass from market research needs Stripe Checkout; Clerk Billing cannot
  sell one-time products. The free plan is one live 7-day plan per year and one saved trip.
  `billing_usage` resets monthly for Care Circle and yearly for Free, not on subscription
  anniversary, and destination and venue runs are not separately metered; the paid feature
  and cache remain the cost guard. A real paid checkout has not been run.
- Billing has no webhook or invoice archive in the app. `has()` session claims are the
  authorization source, and `UserProfile` owns payment and cancellation. Clerk Billing is
  USD-only, does not calculate GST/HST, cannot complete 3-D Secure, and does not issue refunds.
- The learned model does not change live caps yet. When it does, it may only tighten inside the
  engine ceiling; widening requires clinical review.
- Agent copy is model-generated and varies. The engine caps, over-cap caution, source links,
  "approximate location" label, and fallback route are the guardrails; do not remove them.
- The user-owned `README.md` is untouched; this guide is the working file. Light theme only;
  tokens allow a dark theme later.
- The engine invents no venues or geography. The concierge only selects from verified research.
- A returning traveler can reopen an account-owned saved plan, but the post-trip outcome form
  still appears only on the live plan. The saved page does not offer the outcome action; close
  that loop before a pilot that depends on real labels. The old anonymous `GET /api/trips` log
  was removed, so there is no install-scoped trip list.
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
- Clipboard permissions and the delete-account confirmation remain unverified in a real
  browser; the route and unit tests cover the logic, not the platform permission prompts.

## 13. How to work here

1. Read this file, then `BUILD_LOG.md`.
2. Run `git log --oneline`, `git status`, and `git diff`; never discard uncommitted work.
3. Find the first unchecked step in section 2 and continue there.
4. Work in dependency order; keep new work inside the consumer planning product. The
   consented PostgreSQL capture store, account surfaces, live limits, and the calibration
   model are in scope. Do not reintroduce medication, insurance, pharmacy, or coverage
   surfaces without a product decision and a new step.
5. Run the full gate; update this file in the same commit as any change it describes.
6. Commit the exact message, push to `origin`, append to `BUILD_LOG.md`, and set its "Next action".
7. Stuck: three attempts, then change approach once, then log the error under Blockers. Never loop.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
