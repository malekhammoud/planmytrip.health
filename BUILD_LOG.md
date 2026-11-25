# BUILD_LOG

## Decisions

- **Kickoff, no questions.** The directory held `.git` plus a user-owned `README.md`; no
  `AGENTS.md` or `BUILD_LOG.md`, so this is a fresh build, not a resume. Every kickoff
  question had a safe default: npm, initialize in place, no local TinyFish key observed,
  and no Sun Life stability window supplied. The run proceeded without blocking.
- **Scaffold in place.** `create-next-app@16.4.6` ran in a temporary directory inside the
  repo (npm rejects dot-prefixed names), then files were copied in without overwriting
  `README.md`. Generated boilerplate was removed.
- **Vitest 4.1.12.** Vitest 5 requires `@types/node >=22`; the scaffold pins `^20`.
  Vitest 4 avoids `--legacy-peer-deps`. No other test dependency was added.
- **No shell NODE_ENV assumption.** This shell exports `NODE_ENV=production`, so npm
  omitted dev dependencies at first; `npm install --include=dev` installed them. AGENTS
  documents the workaround.
- **Next config trimmed.** Removed generated `cacheComponents` and `partialPrefetching`
  to keep default App Router caching behavior. The Turbopack Tailwind rule stays.
- **Sun Life stability window:** not supplied; `SUN_LIFE_RULES` keeps it as `null` with a
  `// VERIFY:` marker in `lib/sunLifeRules.ts`. No placeholder number is shown.
- **TinyFish:** no key exists locally and the live API is never called in automated checks.
  Tests and `SWARM_MOCK=1` are the verification paths.
- **OpenCode:** the user asked for an agentic concierge using the OpenCode SDK. The embedded
  `@opencode/sdk` host requires Node 26 for `await using`; this workspace runs Node 22, so the
  app uses `@opencode/client` against a running OpenCode service. The API contract, session
  events, and event stream are the same. `OPENCODE_MODEL` is explicit so a free-model quota
  cannot silently replace the configured planner.
- **Agent permissions:** six specialists and one concierge run as read-only researchers with
  `websearch` and `webfetch` only. No shell, write, edit, or subagent access. The OpenCode
  service owns provider credentials; the app never sees them.
- **Geocoding and map:** missing coordinates are filled by Nominatim at one request per second,
  capped at ten places, and labelled approximate. Leaflet renders grayscale OSM tiles with
  numbered, category-shaped markers and a text key. Both providers are licence dependencies
  recorded in the VERIFY register.
- **PostgreSQL, not SQLite:** the capture and model-run store is a `pg` pool with JSONB
  columns and an idempotent schema. Production, dev, and test use separate `DATABASE_URL`
  databases; `npm run db:init` applies the schema. No database file or binary demo is
  committed, and the SSE routes await their pending captures before closing.
- **Computed dose, not self-report:** the concierge's `stepEstimate` is an agent claim. The
  training row is computed from block kind, duration, exertion, and verified hike elevation, so
  live and fallback plans yield comparable doses. An empty day is unsafe, not zero.
- **Calibration, not a new predictor:** the engine's modeled risk is the prior log-odds; the
  model learns the residual. A zero-coefficient artifact is exactly the engine, and a synthetic
  artifact can never drive a live plan.
- **Consent before data:** capture is opt-in on the health step; the only id is a random
  localStorage install id; an unanswered follow-up is not a negative label.
- **Scripts with `tsx`:** `tsx` is a dev dependency for the synthetic and training CLIs. It
  resolves TypeScript and path aliases without a build step.
- **Route derived, not re-planned:** the route planner orders stops inside a day, pins meals,
  and chooses a leg mode, but never moves a place to another day. The plan, the computed dose,
  and the captured dossier therefore stay identical. Cross-day pacing is instructed in the
  concierge prompt and reported as a caution; reassigning days needs its own capture-aware step.
- **TinyFish reads venues, not just verification:** the concierge still discovers and
  sequences places; TinyFish now opens the selected menu or booking URL and extracts
  structured menu items and room rates with a source and checked time. The venue route asks
  for no recording, runs three browsers at a time, and keeps the engine as the safety
  authority. Venue evidence is a display layer and never changes a cap, the dose, or the plan.
- **Venue cache identity includes the place:** the first version keyed a menu only by URL, so
  two restaurants that shared a HappyCow city listing overwrote each other. The v2 key adds the
  place id; hotel keys also carry dates and party. Menu facts live 7 days, rates 12 hours, and
  the cached envelope replays real recorded sources and activity offsets.
- **A failed page is evidence too:** the venue deck keeps every successful fact when one page
  times out or is blocked, shows a calm partial-run caution, and retries only the missing
  pages. A preferred booking or menu URL falls back to the plan's source page once before the
  worker fails. **Legacy verification remains mounted for now:** the user considers the video
  verification layer legacy, but retiring it is a separate step so this one can land the venue
  surface without breaking the cached-recordings path.

## Blockers

None.

## Step log

### Step 1: project baseline

- Next.js 16.4.6, React 19.3.0, Tailwind 4.3.3, TypeScript strict, Vitest 4.1.12.
- Added Paper and Ink tokens and type classes, condition vocabulary, `.env.example`,
  design guard, contrast tests, smoke test, AGENTS.md, and this log.
- Gate: typecheck, 41 tests, lint, and production build all pass.
- Reviewer (fresh context): 5 major guard holes (axis palette variants, arbitrary
  shadows, Tailwind v4 gradients/blur, off-system radii, arbitrary text sizes) and 4
  minor (flags/images unenforced, no negative fixtures, build-status copy, mobile gap).
  All fixed before commit; guard now has 19 banned and 4 allowed fixtures.
- Unverified: no live TinyFish run; docs fetched and event schema recorded in AGENTS.

### Step 2: design system primitives

- Added all `components/ui` primitives with typed props, named exports, two pure
  helpers, and CSS modules for native range, skeleton pulse, and status pulse. Added
  `.t-button` and `.t-data-sm` to the shared type scale.
- Added Button `lg` (48px) only for the Step 5 Deploy action, which requires 48px.
- Gate: typecheck, full suite, lint, and production build pass. Step 2 helper tests: 13.
- Review: two hostile cycles. Ten defects fixed (Metric units, tooltip IDs/overflow/
  WCAG, Select placeholder, Field alert, slider alignment, DataRow overflow, 11px
  captions, TSDoc); three residual minors fixed before commit. No blocker.
- Unverified: no browser rendering of native range thumbs, tooltip placement, or
  checkbox focus ring; the Step 5 dev-server pass will check them.

### Step 3: biological pacing engine

- Split the engine into healthTripTypes, conditionProfiles, sunLifeRules, healthScore,
  itineraryBuilder, and a public healthTripEngine entry; every file under 250 lines.
- Five readonly profiles with VERIFY lines, modeled residual-risk floors, generic
  medication defaults, a deterministic 30-case condition/day matrix, caps, mandatory
  recovery, Day 1 acclimation, a lighter final cap, and a modeled score formula.
- Review cycle 2 fixed cap consistency (0.5 m modeled stride), full optional recovery,
  PACING_POLICY, an itinerary invariant error, recovery/meal step accounting, the 2-day
  final-day case, missing validation tests, a placeholder/administrator constant, and
  documentation precision. Engine tests split into two files plus shared fixtures.
- One `SUN_LIFE_RULES`: 60-day cap, Allianz 24/7, stability window `null` (not
  supplied); no invented number; every alert includes the administrator notice.
- Gate: typecheck, 52 engine tests (106 at this commit; 145 with uncommitted Step 4),
  lint, and production build pass.
- Unverified: clinical thresholds, residual floors, stride, and insurance rules need
  clinician and plan-administrator confirmation. No UI labels yet.

### Step 4: TinyFish 3-worker SSE route

- Added the nodejs POST route with hand-validated bodies, 15s keep-alive, guarded
  enqueue, 110s per-worker timeout, client-abort propagation, and always-last
  swarm_done. Three concurrent isolated workers with exact JSON schemas.
- Split into pure SSE parser, TinyFish client, event mapper, worker goals/normalisers,
  runner, mock module, and a thin route. Shared Sun Life rules imported, not duplicated.
- Mock mode is dev-only and tags every payload; missing key streams missing_api_key
  errors as a normal 200. No key is logged or echoed.
- 39 Step 4 tests (145 total at this commit); parser, mapper, validation, isolation,
  retry subset, timeout, sync throw, sibling abort, URL schemes, mock, and production.
- Review cycle 1 fixed nullable sourceUrl, a coverage goal/schema mismatch, rejection
  handling, placeholder variants, unsafe streaming URLs, and the missing docs.
- Gate: typecheck, 145 tests, lint, and production build pass.
- Unverified: no live TinyFish run or real key; streaming URL expiry and proxy behavior.

### Step 5: header, constraint rail, page layout

- Added the client home page, sticky letterhead, footer, 320px constraint rail with
  sticky/scroll behavior, mobile `<details>` panel, headline from describeTrip, live
  Sun Life Callout, Deploy action, and designed Pacing/Verification mounts.
- Added `describeTrip` and four tests; page state is fully owned by page.tsx, and the
  medication default updates only until the field is edited.
- Fixed a first-dev-pass CSS bug: the Turbopack Tailwind loader made CSS-module exports
  empty (`class="undefined"`, native slider). Moved Slider/Skeleton/StatusGlyph styles
  into global token classes in globals.css and restored the all-CSS loader rule.
- Visual check: headless Chrome at 375, 768, and 1280; no horizontal scroll, rail
  sticky at 88px, footer and link present; dev server returned 200. Removed screenshots.
- Review: one major and four minor defects fixed. The uncontrolled mobile `<details>`
  could hide the desktop rail after resize; it is now controlled and forced open at
  1024px (CDP test: collapse at 768, resize to 1024, panel open and 320px wide). Focus
  rings got 4px rail padding, permanent `aria-busy` was removed, the summary wraps long
  destinations, and Slider now forwards Field ARIA bindings.
- Gate: typecheck, 149 tests, lint, and production build pass. Next.js dev typegen added
  a `.next/dev/dev/types` include to tsconfig; kept.
- Unverified: hydrated interaction beyond the rail resize check; the Deploy button
  increments a nonce only until Step 6.

### Step 6: live agent swarm monitor

- Added the three-column monitor with designed empty state, StatusGlyph phases, live
  16:10 iframes, 28px LIVE bar, last-3 progress, typed findings, source/retrieved time,
  raw JSON toggle/copy, mock Callout, and per-worker Retry.
- Pure reducer plus state module, run-token hook, POST/stream transport, frame
  validation, Strict Mode duplicate guard, abort, and per-worker latest-request ids.
- Split reducer, reducer tests, and stream transport to keep every file under ~250.
- Review cycle 1 fixed: retry now reuses the run's input snapshot; the monitor shows a
  "Last run" context and warns on changed inputs; raw JSON copy failure is announced;
  idle worker events are rejected; column order, PREPARING bar, 44px copy/link targets,
  worker-specific Retry labels, and an https preview allowlist (`*.unikraft.app`,
  `mock.invalid`) are in place.
- 13 reducer/frame tests; 179 total at this commit.
- Browser: mock completion and missing-key/Retry paths exercised; no live key.
- Unverified: live iframe preview and real SSE stream.

### Step 7: KPI strip and paced itinerary

- Added the KPI strip (score/baseline bars, daily ceiling, risk reduction, visible
  Modeled estimate labels, input tooltips), hairline day rows, 64px day numbers, caps,
  inline SVG pacing strips with hatching and 2-hour axis, checkpoint tint, and care card.
- Added pure layoutStrip and buildCareCard with 15 tests; wired ItineraryBoard and
  AgentSwarmMonitor into app/page.tsx, with an empty-destination empty state.
- Findings use a new DataRow `layout="stacked"` variant; the 120px row was unreadable in
  three narrow worker panes. `.t-metric-day` is unlayered so Tailwind emits it.
- Review cycle 1 fixed: HSS compare says "Standard baseline" and its tooltip lists the
  profile floor and standard assumptions; caps compose stacked DataRows; walk caps show
  one decimal; the legend uses the same hatch; the strip aria-label carries the time
  range; reduced motion zeros the stagger delay; copy success is announced.
- Browser checks: 375/768/1280 no horizontal scroll; mock run completed with three
  findings columns; missing-key run showed three plain errors and Retry buttons.
- Gate: typecheck, 179 tests, lint, production build pass.
- Unverified: real TinyFish iframe/SSE, clipboard permissions, live key behavior.

### Step 8: documentation and identity audit

- Compressed AGENTS.md to 399 lines; corrected the file tree, test inventory, rail state,
  monitor wording, reduced-motion and streaming_url claims; documented no-CSS-modules.
- Added headers to three lib test modules and TSDoc to re-export blocks; fixed one stale
  Step 6 comment; kept ItineraryBoard at 250 lines.
- Identity: photo/flag/stoplight/score-card/gradient/shadow greps clean; 375px layout and
  tap targets reviewed in source; design guard and 13 contrast pairs pass.
- Gate: typecheck, 179 tests, lint, production build pass; dev server 200 and mock SSE
  verified with curl after a background start. Lockfile unchanged.
- Unverified: no live TinyFish run or real iframe/clipboard, as before.

## Production deployment (2026-11-21)

- Hosted at https://planmytrip.health (canonical apex, `www` 301) behind nginx on
  127.0.0.1:3005, with `planmytrip.service` on a dedicated system account and Certbot TLS
  for the apex and `www`.
- The first live TinyFish run exposed two integration mismatches: previews now come from
  `*.tetra-data.production.tinyfish.io` (docs still show `*.unikraft.app`), and a valid
  advisory run was cut off at 110s while still navigating. Allowlisted `*.tinyfish.io`,
  raised the worker timeout to 240s, and set the route `maxDuration` to 300.
- A second live one-worker run completed in 165s with advisory findings, a preview URL,
  and `swarm_done` `completed: ["advisory"]`. A full three-worker run and iframe rendering
  remain unverified.
- Gate: typecheck, 179 tests, lint, and production build pass.

### Step 9: agentic concierge and trip map

- Added the OpenCode planner route, six parallel research specialists (stay, table, trail,
  culture, transit, care), and a lead concierge. Each specialist has its own system prompt,
  exact JSON shape, source rules, timeout, and read-only web permissions. The concierge
  receives the verified research plus the engine's day ceilings.
- Added the typed planner SSE contract, pure frame validator, reducer, snapshot hook, roster,
  bounded live activity log, plan-above-roster completion view, and per-day estimate/ceiling
  comparison. A degraded fallback route is built from verified picks if synthesis fails.
- Added Nominatim geocoding for up to ten missing coordinates, one request per second, with an
  identifying User-Agent and an approximate label. Added a client-only Leaflet map with
  grayscale OSM tiles, numbered category markers with 44px hit areas, per-day dashed routes,
  a legend, a numbered key, and the required attribution. Disabled Leaflet's flag prefix.
- Added `OPENCODE_MODEL` explicit session selection after a free-model quota caused an early
  all-agent failure; quota failures now map to `agent_unavailable`.
- Installed the supplied OpenCode Go API key in the OpenCode service credential store, not the
  repository, and verified it with a live `opencode-go/deepseek-v4.1-flash` session. The old
  credential remains inactive for rollback.
- Live OpenCode run 1 on 2026-11-21 completed six of seven specialists in about 10m45s against
  Lisbon; care timed out on the older two-to-four-hospital scope. Care now asks for a tighter
  scope and 10 steps.
- Live OpenCode run 2 on 2026-11-21 (2 days, final timeouts) finished in about 12 minutes with
  four of seven agents: table, trail, culture, and the concierge. Stay, transit, and care
  returned JSON the parser rejected, not timeouts. The plan still had six verified places,
  two capped days, eight safety notes, and honest missing-stay/care copy. Five of six places
  had coordinates; the sixth did not geocode.
- After run 2, JSON extraction was hardened with balanced-object scanning, trailing-comma
  repair, and single-element array unwrapping. Geocoding now retries with a simpler
  name-and-destination query. Those fixes are covered by tests but have not been re-run against
  a live concierge pass.
- Added 59 planner tests (238 total) covering request bounds, parsing, specialist normalization,
  coordinate validation, concierge plan building, wire normalization, fallback, prompts,
  activity humanization, geocoding including fallback, reducer transitions, frame guards, and
  the full mock SSE route. All network is mocked.
- Gate: typecheck, 238 tests, lint, production build pass. Browser checks: 375/1280 layout,
  mock concierge run, 13 numbered map markers, 44px marker hit areas, five legend dots, map
  key, bottom-left attribution, plan-above-roster view, no console errors. A stale Turbopack
  stylesheet cache hid the new legend until `.next` was cleared. The dev server re-added the
  Next.js agent-rules block to AGENTS.md.
- Unverified: live re-run of the hardened JSON parser and geocode fallback, a 7-of-7 live
  agent pass, full live map rendering, production tile/Nominatim licences, and a real OpenCode
  service supervised in production.

### Step 10: onboarding and tabbed workspace

- Replaced the permanent constraint rail and the single 12,000px results page with two
  screens. `Onboarding` is a two-step form: destination, duration, budget, and preferences,
  then condition, medication, coverage, the live Sun Life alert, and a review sentence. The
  primary action reads Continue, then Build my plan. `lib/onboarding.ts` holds the pure draft
  gate and normalization.
- Replaced the results page with `PlanWorkspace`: a trip summary, Edit trip and Plan again
  actions, and four ruled tabs — Plan, Pacing, Verification, Team. The new `TabBar` primitive
  has roving focus and arrow, Home, and End keys; the active tab is an accent underline, not a
  pill. All panels stay mounted and toggle with `hidden`, so both SSE streams keep running.
- The Plan tab leads with the finished concierge plan or the live roster and activity log.
  Pacing carries the safety envelope and care card. Verification carries the TinyFish columns.
  Team carries the full roster and log. The plan map receives `visible` and calls
  `invalidateSize` when the tab or the workspace returns; its numbered key is a collapsed
  details block.
- Editing returns to onboarding without discarding the running workspace; Back to plan resets
  the draft and restores the workspace. The workspace is keyed by `deployNonce`, so a new build
  or replan remounts on Plan and aborts older streams. The KPI strip is now three-up from 768px
  because the rail no longer narrows the column. Removed `ConstraintSidebar` and `AgentPlanner`.
- Added 7 tests (245 total): onboarding draft gate and normalization, plus tab keyboard order.
  Browser checks: onboarding at 375/1280, step 2, mock workspace at 375/1280, all four tabs,
  Plan → Pacing → Plan map resize, Edit trip / Back to plan state preservation, no console
  errors, no horizontal scroll, tabs fit 375px.
- Gate: typecheck, 245 tests, lint, production build pass. The Next.js dev server re-added its
  agent-rules block to AGENTS.md.
- Unverified: live 7-of-7 agent run with the hardened parser and geocode fallback; production
  deployment of the new screens.

### Step 11: production deployment and specialist hardening

- Deployed Steps 9-10 to `planmytrip.health` and restarted `planmytrip.service`. Production is
  the `/opt/planmytrip.health` checkout on `127.0.0.1:3005`; the root-only
  `/etc/planmytrip.env` now carries `OPENCODE_MODEL=opencode-go/deepseek-v4.1-flash` and the
  OpenCode Go key. The matching `opencode` v2.3.2 CLI was installed to `/usr/local/bin` so the
  `planmytrip` user can spawn it. Its managed service port is 49375 because the interactive
  root service owns 49374.
- First production concierge run: the app started six specialists but only stay, table,
  culture, and the concierge returned. Care, transit, and trail hit the 10-step limit and
  returned prose instead of JSON. The plan still rendered seven places, five geocoded, a map,
  two capped days, and the safety envelope. The production TinyFish one-worker advisory test
  completed with a live `*.tinyfish.io` preview URL and findings.
- Fix: specialists now have 20 model steps (concierge 12) and 420s each; prompts reserve the
  final steps for JSON and cap tool calls at 10. A live transit and care test then returned
  parseable, non-empty research. The first full production browser workflow after the fix
  completed all seven agents in about 7m40s; the plan arrived at 461s with five mapped places,
  all four tabs switched, Edit trip / Back to plan preserved the workspace, and no console
  errors were recorded. The onboarding screen was checked at 375px and 1280px.
- The earlier production three-worker TinyFish run had advisory and coverage complete, but
  medication and customs timed out at four minutes. Fix: worker timeout is 300s and the route
  budget is 360s; the timeout copy and tests now say five minutes.
- Production retry of medication/customs completed in about four minutes with Salbutamol and
  local brands Ventide, Ventolin, and Ventilastin; customs and carry rules were null/Not found.
  A subsequent full three-worker production run completed all three workers and emitted
  `swarm_done` with no failures. Advisory and coverage returned rich findings; pharmacy
  returned empty findings in that concurrent run, so pharmacy consistency is data-dependent
  and the per-worker Retry remains important.
- Gate: typecheck, 245 tests, lint, production build pass. Production home and planner route
  return 200/400 respectively; the old build's `/api/agent-plan` 404 is gone. Production logs
  after the final restart are clean.
- Unverified: live iframe rendering, clipboard permissions, and pharmacy consistency across
  concurrent runs.

## Next action

Monitor pharmacy consistency in production; if empty findings recur, retry the worker or
revisit the drugs.com goal. Then check the live iframe and clipboard behavior. The clinical
thresholds and Sun Life stability window remain VERIFY.
### Step 12: ML data loop and calibrated flare model

- Added the versioned data contract (`lib/data/types.ts`), a single dose model for engine and
  concierge plans (`lib/data/dose.ts`), the dossier builder (`lib/data/tripDossier.ts`), bounded
  id validation, and server-side capture orchestration. The concierge's `stepEstimate` is kept
  only as an agent estimate; every training row uses the computed block dose.
- Added PostgreSQL storage with a parameterized `pg` pool, JSONB columns, and an idempotent
  schema: `trip_captures` for dossiers and labels, `model_runs` for artifacts. Capture is async
  and its pending write is awaited before the SSE stream closes. The planner route writes on
  `plan_ready`; the swarm route writes on `swarm_done`; `POST /api/trips/outcome` records the
  explicit label; `GET /api/trips` lists one install's trips. Capture requires opt-in consent
  plus run and install ids; mock runs require `PLANMYTRIP_CAPTURE_MOCK=1`. `npm run db:init`
  applies the schema.
- Added the residual calibration model: engine score as the prior offset, penalized logistic
  regression with Laplace covariance, isotonic PAVA calibration, grouped-by-traveler folds,
  Brier/log-loss/ECE/AUROC/slope metrics, evidence tiers, and a model page at `/model`. A
  synthetic artifact is labelled synthetic and is never used for a live plan.
- Added a deterministic synthetic cohort (`scripts/synthetic.ts`, 900 trips, 21.7% flares) and
  the training CLI (`scripts/train-model.ts`). The cohort JSONL is committed for reproducibility;
  the script seeds PostgreSQL only when `DATABASE_URL` is set. Training records a `model_runs`
  row when the database is configured. The SQLite demo database was removed.
- Added the onboarding consent checkbox, a random localStorage install id, and the post-trip
  outcome panel on the Plan tab. No accounts, cookies, email, or free text are stored.
- Tests: 42 new (287 total). Dose and empty-day invariants, dossier and outcome parsing,
  isotonic monotonicity, IRLS coefficient recovery, grouped training and tiers, PostgreSQL
  upsert/outcome/export, outcome and trip-log routes, planner capture, swarm capture, and the
  updated request contract. Database tests use `planmytrip_test` and skip when `DATABASE_URL`
  is absent; Vitest runs files sequentially to avoid truncation races.
- Synthetic artifact metrics: Brier 0.1600 vs engine 0.1674, ECE 0.0121, AUROC 0.6620,
  calibration slope 0.9550. The point is calibration and pipeline, not a headline AUC.
- Verified against PostgreSQL: `planmytrip`, `planmytrip_dev`, and `planmytrip_test` were
  created with separate URLs; the schema applied to all three. The dev cohort seeded 900
  dossiers, 900 explicit outcomes, and 195 flares; training recorded the
  `synthetic-27d2afaf` model run. A direct prediction returned tier `synthetic`,
  pFlare 0.2702, interval 0.2187-0.3521 for the sample trip.
- Added `data:export` and source-aware training. A production browser run with capture consent
  saved one dossier with 2 dose days, 6 research rows, and 3 TinyFish findings; the post-trip
  outcome saved as flare=true, mild, no care. `exportTrainingRows()` returned that labeled row
  with the engine offset. The production database now has 1 trip and 1 outcome; its
  `model_runs` table is intentionally empty until a real artifact is trained.
- Gate: typecheck, 287 tests against `planmytrip_test`, lint, production build pass.
- Unverified: real cohort size, responder-bias correction, privacy review, database backups
  and retention, and any live use of a learned cap.

### Step 13: one-page live workspace and agent warmup

- Removed the Plan / Pacing / Verification / Team tabs. The result is one page: trip masthead,
  live mission band, seven-agent deck, planning signal, route stage, safety envelope, live
  TinyFish verification, and the consented outcome inside the finished plan. Both agent streams
  stay mounted for the whole page.
- Added the mission band (stage, elapsed timer, 0/7 progress, four-step rail), the animated
  signal bar graph and ticker, and a designed route-forming skeleton with an animated dashed
  route. Every agent now shows a phase and its newest message or activity line, so no surface
  sits silent while a session opens.
- Added immediate lifecycle copy: "Preparing the agent runtime", "Opening a specialist
  session", "Waiting for specialist research", and phase messages carried on `agent_status`.
  The internal `queued` phase renders as Starting for planner agents and Preparing for TinyFish
  workers; the word "Queued" is gone from the interface.
- Added `instrumentation.ts` and `lib/agent/agentWarmup.ts`. One fire-and-forget warmup runs at
  Node server start, resolving the OpenCode service, the temporary workspace, and all seven
  agent definitions; the first live request awaits the same memoized promise. A failure is not
  cached, never blocks readiness, and logs only a bounded status line. The workspace path now
  includes the OS user id so a root development run cannot leave a root-owned config that the
  `planmytrip` service cannot rewrite.
- Added Paper and Ink motion in `app/globals.css`: staggered section and deck reveals, activity
  and ticker entrances, signal bars, progress and stage transitions, route flow, marker pops,
  and map route flow. Every effect is decorative, every loop is slow, and reduced motion turns
  all of it off. No gradients, blur, glow, shadows, images, raw colors, or pill styling.
- Tests: 291 total. Added warmup memo/retry/skip, instrumentation runtime guards, planner phase
  message storage and clearing, and frame forwarding; removed the three tab-order tests with
  TabBar.
- Gate: typecheck, 291 tests against `planmytrip_test`, lint, production build pass.
- Production: the service logs `[planner] runtime ready` about seven seconds after boot. A live
  4-day Lisbon run on 2026-11-21 showed the first phase at 1 second, the first real searches at
  3 seconds, and plan ready at 6m12s with all seven specialists complete. The page had no tabs,
  no "Queued" text, a rendered map, and the outcome panel. Live verification completed 2 of 3
  TinyFish workers; medication/customs showed its Retry action. The outcome panel saved an
  explicit false label against the capture. The two browser-test rows were then removed; the
  production store keeps one consented, unlabeled trip and no training labels.

### Step 14: full TinyFish telemetry and mock timeline

- Every worker now sends `agent_config` with `cursor_style: "standard"`, `max_steps: 60`, and
  `max_duration_seconds: 100`; `lib/swarmConfig.ts` owns the limits and the 120-second route
  budget. `/api/travel-swarm` moved from `maxDuration = 360` to `120`.
- Added a monotonic `seq` to every worker frame plus `worker_started`, `worker_sources`,
  `worker_heartbeat`, and `worker_note`. Heartbeats and TF_API_RESULT no longer disappear at the
  mapper; source rows are rebuilt defensively from a direct array, reading only string `url`
  and `title` fields. Unknown upstream types are counted in `swarm_done.summary`.
- Added one retry each for HTTP 400 `INVALID_INPUT` (drop `output_schema`) and `SITE_BLOCKED`
  (switch to `browser_profile: "stealth"`), with calm `worker_note` copy. A second block becomes
  one `site_blocked` error. Error codes now cover blocked sites, step limits, rate limits,
  credits, invalid input, and cancellation.
- Replaced the one-shot mock with a seeded 12-20 step timeline: irregular progress, 2-3 source
  batches, heartbeats every 5 seconds, and staggered finishes at about 35, 48, and 62 seconds.
  `SWARM_MOCK_SPEED` scales the clock and `SWARM_MOCK_FAIL` fails one worker with
  `site_blocked`. `/mock-browser/<worker>` is a dev-only fake viewport that 404s in production.
- Tests: 301 total. Added retry-path tests, mock timeline determinism, a 50x route ordering test,
  source-shape defence, agent-config payload, and unknown-event counting.
- Gate: typecheck, 301 tests against `planmytrip_test`, lint, production build pass.
- Decision: the route cap is 120 seconds even though earlier live runs took longer. The upstream
  limits stop the agent first, so the client never has to invent a terminal state.

### Step 15: live swarm telemetry model

- Extended `WorkerState` with the run id, start and end times, current purpose, up to 200 steps
  plus a full step count, heartbeat count and last time, up to 100 deduplicated sources, up to
  20 notes, retry count, last event time, and last accepted sequence. Duplicate and
  out-of-order frames are ignored per worker.
- Added `lib/swarmTelemetry.ts`: elapsed time, five-second tempo buckets, connection health
  (`live`, `quiet` after 12s, `stalled` after 30s), a summary, a merged feed capped at 300
  lines, merged source rows, and the staleness comparison. Heartbeats are counted but never
  become feed lines.
- Added `hooks/swarmBatch.ts`, so the swarm stream coalesces a burst into one reducer pass per
  animation frame, and `hooks/useNow.ts`, which ticks once a second only while a worker is
  queued or running.
- Tests: pure derivations cover empty input, buckets with gaps, duplicates, out-of-order
  sequences, source merging, staleness, and all caps; the batch queue is tested with fake
  timers.

### Step 16: live mission control

- Replaced the three-column report with `components/mission/`: a sticky status bar, three
  tab tiles, one mounted 16:10 live view per worker, a 320px activity feed, a source ledger,
  pre-run instruction rows, and findings. `PlanWorkspace` now owns `useSwarm` and passes its
  state and actions down.
- Auto-follow selects the worker with the newest progress unless the reader pins a tile;
  arrow, Home, and End keys move the selection. The focused view carries the preview host,
  LIVE marker, elapsed time, `step n of 60 max`, Fullscreen Expand, the current purpose, and
  the tempo strip.
- Completion shows "Run complete" for one second, follows the next active worker, and swaps
  the iframe for a static "Stream ended" frame after 1.5s. All three focus views stay mounted,
  so switching tiles never reloads a stream.
- Added the typed activity feed with filters, typing only for a lone new line, two-second
  settle, auto-scroll with a jump control, and a 300-line cap. Heartbeats never become lines.
  Sources grow from TF_API_RESULT and search/fetch steps with deduplication; findings appear
  only at COMPLETE with a 60ms stagger, provenance, and the raw JSON toggle.
- Added `lib/swarmErrors.ts` for calm error copy, `PreRun` with the exact goal disclosure,
  the stale-input caution, the mock caution, and the browser-title states.
- Added the motion vocabulary `--ease`, `--dur-fast`, `--dur-base`, `--dur-slow` and
  `.anim-fade`, `.anim-rise`, `.anim-arrive`, `.anim-tick`, `.anim-pulse-dot`,
  `.anim-collapse`, all disabled under reduced motion with a static New label replacing the
  arrival wash. The design guard now rejects `animate-spin|ping|pulse|bounce` and
  `transition-all`, and checks the reduced-motion block.
- Tests: 329 total. Added error copy and mission formatting tests; guard fixtures now cover the
  banned animations and transition-all.
- Verified in mock mode at 1280px and 375px: no horizontal overflow, real iframe content,
  `(3 running)` and `Verified 3/3` titles, zero console errors, and no "Queued" text.

### Step 17: tighten-only verification overlay

- Added pure `lib/verificationOverlay.ts`. An advisory heat, air-quality, altitude, outbreak,
  or allergen match appends a bounded "Verified note" to day checkpoints; heat and air quality
  on a sensitive condition extend that day's recovery block by 30 minutes, at most once per
  day. A coverage pre-authorization string becomes a display-only checklist adjustment.
- The overlay never changes step or walking ceilings, scores, or the Sun Life alert. It is
  deterministic, idempotent, and a no-op for null, empty, unrelated, or "Not found" findings.
  A master switch and per-adjustment ids mark what applied.
- Tests: property coverage over every condition and 2-7 days proves recovery never decreases
  and caps and scores never change. Added determinism, idempotence, no-op, toggle, and
  checklist tests. Total suite is 335 tests.
- Decision: day checkpoints receive global advisory notes on every day because the advisory is
  destination-wide, not date-specific. Recovery extensions are per-day adjustments so each
  row can be toggled and explained.

### Step 18: animated plan changes and live adjustments

- Wired the overlay into `PlanWorkspace`. `useSwarm` findings feed `applyVerification`; a
  master "Apply live adjustments" Checkbox and one Checkbox per adjustment live under the
  safety SectionHeader. Turning the master off restores the engine plan exactly.
- Applied recovery adjustments mark the day row with `.anim-arrive`, "Adjusted by
  verification", the minutes diff, source link, and retrieved time. The checkpoint carries the
  verified notes. Pacing bars now animate with `transform` (scaleY for exertion, scaleX for
  recovery) over `--dur-base`, with transitions disabled under reduced motion.
- The KPI strip gains `Live verification: n of 3 sources checked`, tweened KPI numbers with
  `easeOutCubic`, and four-second diff blocks such as "Step ceiling 6,000 to 5,000 steps".
  `lib/planMotion.ts` is pure; `hooks/usePlanMotion.ts` owns the frame loop and diff lifetime.
- `buildCareCard` accepts applied adjustments and appends their reason, source URL, and
  retrieved time. The existing no-adjustment output is byte-for-byte unchanged.
- Tests: 340 total. Added easing and diff detection, care-card provenance, and overlay-toggle
  property coverage. Verified in mock mode that the master toggle restores 30-minute recovery,
  a per-adjustment toggle restores one day, and the source links remain present.

### Step 19: hardening and documentation

- Stream audit at `SWARM_MOCK_SPEED=12`: 3 `worker_status`, 3 `worker_started`, 3
  `streaming_url`, 44 `worker_progress`, 8 `worker_sources`, 1 heartbeat, 3
  `worker_complete`, then `swarm_done`. Per-worker sequences were monotonic (advisory 1-20,
  pharmacy 1-25, coverage 1-20), and the final summary reported 44 steps, 15 sources, 3
  findings, 0 unknown events. Byte count 13,878 with no buffering.
- Fail path with `SWARM_MOCK_FAIL=coverage`: coverage emitted `worker_error` code
  `site_blocked` after real progress, the other two completed, `swarm_done` listed the failed
  worker, the status read "Verification complete" with `2 of 3 findings`, the title read
  `Verified 2/3`, and the focus moved to the failed worker with a Retry action.
- Reduced-motion audit with `Emulation.setEmulatedMedia`: `animationName` was `none` for
  `.anim-pulse-dot`, `.anim-rise`, and `.anim-arrive`; typing was instant; the pace strip
  transitions were off; 19 static "New" labels marked arrivals and remained readable.
- Alive rubric over every new file: all eight checks pass. Real events only, no percentage or
  ETA, reduced motion complete, idle stillness, clock isolated to time and silence states,
  feed/source caps, quiet and stalled states, and the Paper and Ink guard green.
- Docs: AGENTS.md now carries the event schema, telemetry model, mission-control component
  map, motion tokens and classes, overlay rules, mock env vars, guard additions, and four new
  VERIFY rows (limits, stealth retry, TF_API_RESULT shape, multi-viewer iframes).
- Decision: the P4 change chip and tween are wired to a plan prop change, but Edit trip
  remounts the workspace by design (Step 13), so the current flow does not exercise the chip
  in the browser. The pure math is tested; a future in-place sidebar will show it.
- No push: this phase commits locally only, per the safety rail.

### Pitch deck (2026-11-21)

- Added a static 1920×1080 Paper and Ink deck at `public/pitch/`, served at `/pitch` by a
  rewrite in `next.config.ts`. Eight presented slides plus a data-moat appendix: cover,
  problem, solution, demo cue, architecture, comparison, impact, close, and appendix.
- The deck uses the product tokens and type classes, local Instrument Serif, Hanken Grotesk,
  and IBM Plex Mono woff2 files, an inline SVG architecture diagram, and one personal
  photograph (`basil.jpg`), used with the family's consent and the only raster asset.
- Added `docs/PITCH.md` with the 2:55 script, the tab-by-tab demo runbook and fallback ladder,
  sources, the 0-of-5 planner audit, and a rubric check.
- Gate: typecheck, 286 tests, lint, production build pass. `/pitch` and all assets return 200
  from the production build.
- Unverified: the live presentation with two staggered runs; the 0-of-5 audit screenshots.

### Pitch deck copy revision (2026-11-21)

- Enlarged the cover photograph to 900px, moved the story line into a full-width bottom band,
  and added the "Basil and his mother" caption and a vertical hairline. The cover now uses the
  full page instead of leaving the lower half empty.
- Replaced the cancer-specific problem statistic with general-health prevalence: 45% of
  Canadians live with a chronic disease, 1 in 12 with three or more, and 64% of adults 50+ plan
  a trip this year. The gap remains 0 of 5 planners.
- Plain-language pass: the cover, solution, impact, and close now state the problem and the time
  saved without metaphor.
- Gate: typecheck, 286 tests, lint, production build pass.

### Step 20: production readiness and nested calibration

- Rebuilt the evaluation half of the model. Feature scaling and logistic coefficients are
  now fitted inside each fold, and an inner grouped cross-validation fits the isotonic map
  before it scores an outer fold. The old reported ECE (0.0121) was in-sample for the
  calibrator; the honest nested ECE is 0.0238. Brier is 0.1612 against the engine's 0.1674,
  AUROC 0.6620, calibration slope 0.9549. The artifact records `pipelineVersion: 2`; the
  committed cohort and artifact are now `synthetic-5a38cf18`.
- Hardened artifact loading: `artifact.ts` now dimension-checks features, statistics,
  coefficients, covariance, isotonic knots, condition counts, and metrics; rejects another
  pipeline, another engine version, a zero-row file, and a mismatched metric count; and
  falls back to the engine-only artifact. `tierFor` treats a zero-row or stale-engine
  artifact as the engine.
- Closed capture integrity holes. The synthetic cohort marks every row `synthetic: true`;
  both the training CLI and `trainModel` refuse it under `--source outcomes`. Export now
  excludes mock plans, other data schemas, and other engine versions. Conflict updates are
  scoped to the original install id for dossiers and swarm findings, so another browser
  cannot overwrite a run. Pool limits are bounded and an idle-client error can no longer
  crash the process.
- Closed a real safety gap in the concierge and fallback routes. A day's cap flag now uses
  the computed block dose as well as the agent estimate, so a long hike with a low
  self-report still shows the over-ceiling caution. The fallback sizes each anchor against
  the engine's step and walking ceilings and reports the computed dose instead of an invented
  factor. `normalizeWirePlan` keeps block place ids, so the map draws its per-day routes.
- Made the post-trip label explicit: the flare question is a required Select, not a
  pre-unchecked box. The public outcome route ignores free text, so the privacy claim is now
  true. The install id read survives blocked localStorage.
- Bounded untrusted upstream text: worker findings, lists, checklist items, raw results,
  progress copy, and preview URLs all have finite limits; URLs are rejected rather than
  truncated. Leaflet tooltips now use a text node, so a place name from research can never
  become markup.
- Hardened transport and privacy edges: PostgreSQL TLS now validates certificates instead of
  disabling verification, the app sends `nosniff`, a strict referrer policy, and
  `X-Frame-Options: DENY`, and the trip log prefers an `X-Install-Id` header so the anonymous
  install id stays out of proxy URLs.
- Added 57 tests (348 total): nested calibration and pipeline-version guards, deep artifact
  validation, engine fallback, model/cohort/card reproducibility, no-live-model-import
  guard, computed-dose cap reconciliation, fallback anchor sizing, wire place ids, captured
  dose, mock/schema/engine export filters, install isolation, bounded limits, explicit
  outcome parsing, upstream bounds, and a PostgreSQL capture-to-outcome-to-export-to-train
  loop.
- Gate: typecheck, 348 tests with the test database (321 pass and 27 skip without it), lint,
  and production build pass. A production `next start` smoke returned 200 for `/` and
  `/model`, 200 for the install-scoped trip log through both the header and query, 400 for a
  missing id, and 404 for an unknown outcome; the baseline security headers were present. No
  live OpenCode, TinyFish, Nominatim, or tile request was made.
- Unverified: real traveler labels, responder bias, a returning-traveler outcome flow, the
  live three-worker and 7-of-7 passes, and every clinical and insurance threshold.

### Step 21: transport-aware route and Maps handoff

- Added `lib/route/`: great-circle geometry, per-leg mode choice, an open-path visit optimizer
  (nearest-neighbour seed, 2-opt, Or-opt), the plan-to-route projection, and the Google Maps
  URL builder. `docs/ROUTE.md` records the algorithms, complexity, and limits.
- Onboarding step 01 now asks for an optional starting point and the travel method. The
  request, planner prompt, and workspace summary carry both; the concierge is told to group
  each day around one area reachable by that method and never to place two demanding days back
  to back.
- Each day's place-bearing blocks become stops with verified coordinates. Meals and check-ins
  keep their slot, the day's own base is not repeated, and the rest are ordered from the base.
  Legs resolve to walk, transit, or car. A demanding day (a hike, or 70% of the walking
  ceiling) avoids walking above 0.6 km when the selected mode allows it.
- `RoutePanel` shows trip and day totals, the ordered stops, each leg with its mode, the
  engine's day ceiling, cautions, and one Google Maps button per day plus an arrival link. The
  map draws the optimized order. Times are labelled modeled, and the panel says the links send
  the stops to Google.
- Fixed a pre-existing wire bug: `normalizeWirePlan` looked blocks up by `placeName`, but wire
  frames carry `placeId`, so every block lost its place on receipt and the map never drew day
  lines. Blocks now resolve by id or name, with a round-trip test.
- Tests: 361 total. Added 62 route tests plus request, onboarding, prompt, and wire round-trip
  coverage.
- Verified in a mock run at 1276 px and 375 px: four day links, the arrival link, four map
  lines, no horizontal overflow, and 44 px map buttons.
- Gate: typecheck, 345 passed with 16 PostgreSQL tests skipped because no `DATABASE_URL` is
  configured in this environment, lint, and a production build.

### Pitch deck aligned with main (2026-11-21)

- Fast-forwarded `feat/pitch-deck` to main; the deck already existed on main through the
  `merge: add Paper and Ink pitch deck` commit.
- Updated the demo slide for the one-page workspace: Mission, Route, Safety, Verification.
  The architecture line adds PostgreSQL and the 466-test gate; impact now reads seven minutes,
  the measured production run.
- Rewrote the demo runbook to scroll the one page instead of switching tabs. The copy, problem
  statistics, comparison, and close are unchanged.
- Gate: typecheck, 466 tests (439 passed, 27 database tests skipped without `DATABASE_URL`),
  lint, production build pass.

### Pitch deck architecture and ML pass (2026-11-21)

- Rebuilt the architecture slide as two loops: the live run (seven OpenCode agents, the route
  optimizer, engine caps plus the tighten-only overlay, three TinyFish browsers) and the data
  loop (dossier, outcome, PostgreSQL, the calibration model).
- Added two appendix slides: the nested calibration model (prior offset, residual, isotonic,
  tiers, ship gate) and the data asset (record, consent, scale ladder).
- Removed tab language from the demo materials; the workspace is one page. Impact now reads
  "Hours of research become seven minutes."
- Gate: typecheck, 466 tests (439 passed, 27 skipped), lint, production build pass.

### Pitch deck plain section titles (2026-11-21)

- Replaced the assertion headlines with the presenter's section names: Problem, Solution,
  Demo, Architecture, Comparison, Impact, Model, Data. The close keeps its memorial line.
- Impact now carries "Hours of research become seven minutes" in the body; the architecture
  slide keeps "Generation is probabilistic. The ceiling is not." with one accent.
- Gate: typecheck, 466 tests (439 passed, 27 skipped), lint, production build pass.

### Step 23: live command surface

- Replaced the scrolling report with a command surface. A sticky `CommandBar` carries the
  destination, the current stage and four-step rail, both run clocks, real agent/step/source/
  finding counts, the newest activity line, and the trip actions. Two progress rules show the
  planner and verification counts; every value comes from an accepted event. The mobile bar
  keeps the newest line and drops the mock-only note beside Save trip.
- The named-area grid now reflows through four live stages instead of one ready state:
  `forming` leads with the planning deck, `researching` sets the stage beside the deck,
  `composing` gives the stage the width, and `ready` leads with the stage and a compact deck.
  Verification spans the full width at ready and moves above the safety envelope while its
  workers run, then returns below once they settle. Panels move by grid area with a fade;
  neither stream nor any of the three preview frames is unmounted. `lib/agent/plannerStage.ts`
  now exports the surface mode, stage position, and newest agent as pure functions.
- Added `DayFocus` as the map control: All days or one 44px day button, arrow/Home/End keys,
  and a focus strip with the day's estimate and ceilings, walking distance, recovery, and
  checkpoint. Selection fits the map to that day's stops, dims the other markers, opens the
  matching route and day-plan rows, and rules the matching envelope row. A new map overlay
  names the focused day; route and day rows carry "Map" actions that return to it.
- The planning deck keeps the live roster while forming and becomes a seven-cell strip at
  ready. It follows the agent with the newest activity line unless the reader pins one; the
  focused agent's phase, checks, recent activity, result, or error opens below. The roster
  marks the newest agent. The deck uses container queries, so it stays readable when research
  moves it into a narrow column.
- The activity rail switches between the planning signal and the verification feed. It follows
  the stream with the newest real line, and verification once the plan is ready, unless the
  reader pins one; `Follow live` restores auto-follow. Both feeds stay mounted, the newest
  planner line carries an arrival wash, and the existing feed keeps its filters and jump
  control. `useElapsed` resets on a new run so the clock cannot carry a retry.
- Mission control now follows its own focus: the three tiles still choose the live frame, and
  the sources and findings panes show only the pinned or auto-followed worker. All findings
  remain reachable by switching a tile. The live frame is capped at 520px high on wide
  screens. `StatusBar` and the section header keep the real running and finding counts.
- The safety envelope keeps every day's step and walking caps visible. The focused day (shared
  with the map) opens its pacing strip, block list, and checkpoint; other days stay compact.
  Live adjustments are a two-column switch list, so all sources and diffs remain readable.
  Secondary concierge material (selected places, booking list, sources) is a disclosure.
- Added a fixed five-item mobile dock (`Route`, `Team`, `Checks`, `Safety`, `Activity`) below
  1024px. It jumps to the mounted sections with scroll margin under the sticky bars, shows a
  live dot on running streams, and uses 44px targets. 375px has no horizontal overflow.
- Added 8 pure stage tests (surface modes, stage position, newest agent) and updated the suite
  count. Mock verification at 1280 and 375 covered forming, ready, a selected day, a pinned
  agent, a pinned verification stream, the dock jump, the live-to-settled verification reflow,
  and reduced motion. A MutationObserver recorded all four surface modes: forming, researching,
  composing, and ready.
- Gate: typecheck, 481 tests with the test database, lint, and production build pass.
- Unverified: a live seven-agent run and a live three-worker TinyFish run with the new
  reflow and per-worker findings focus. Both were exercised in mock mode only.


### Step 24: Clerk accounts and saved trips

- Added `@clerk/nextjs` 7.10.7 with required sign-in at `/sign-in` and `/sign-up`. The
  planner page, saved-trip pages, planner and swarm routes, outcome route, and trip log now
  require a Clerk session. The header carries `Saved trips` and `UserButton`.
- Added account-owned saved trips. `saved_trips` is keyed by `clerk_user_id` and stores one
  validated `TripConfig` and `AgentTripPlan` snapshot per `(clerk_user_id, run_id)`. The
  authenticated `/api/saved-trips` routes list, save, read, and delete only that account's
  rows. `/trips` lists summaries and `/trips/[id]` rebuilds the deterministic engine envelope
  around the captured plan. Mock plans are never saved, and the anonymous consent-gated
  `trip_captures` table is unchanged.
- Production Clerk is `app_3MR7sJ2fhslkGXYl4yRqjseO13C`. The domain is configured with
  `proxy_url: https://planmytrip.health/__clerk`; `ClerkProvider` uses the same origin. Keys
  live only in `/etc/planmytrip.env`.
- Next 16.4.6 hangs when Clerk's middleware returns its full request-header override set.
  `proxy.ts` now forwards only `x-clerk-*` auth request headers, preserving response cookies
  and the Frontend API proxy. The workaround is load-bearing; see `docs/AUTH.md`.
- The Clerk production custom-domain CNAME records are not used for the browser session.
  The domain Dashboard selection does not authenticate the CLI; `clerk auth login` remains a
  host action before account-level CLI commands.
- Added 10 tests: saved-trip request bounds, normalisation, mock rejection, id validation,
  and PostgreSQL upsert, ownership, list, read, and delete. The suite is 481 tests; 30
  database tests skip when `DATABASE_URL` is absent. `tests/mocks/clerk-server.ts` gives route
  handlers a stable test account.
- Gate: typecheck, 451 passed / 30 skipped, lint, and production build pass. Production smoke:
  `/` 307 to `https://planmytrip.health/sign-in`, `/sign-in` 200, Clerk JS proxy 200,
  `/__clerk/v1/environment` 200, and `/api/saved-trips` 401. `npm run db:init` applied
  `saved_trips` to the production database.
- Unverified: a real first-user sign-up and sign-in, saving and reopening a trip in a browser,
  the Clerk email/account-portal CNAME records, and a real account-deletion cleanup.

### Step 25: Clerk form appearance

- The prebuilt Clerk form received `var(--accent)` and the other tokens as appearance
  variables. Clerk's own color variables do not resolve those custom properties, so the
  primary button rendered transparent white-on-white. The sign-in form appeared to have a
  blank space where Continue belongs.
- Added `lib/clerkAppearance.ts` with literal Paper and Ink values and pointed
  `ClerkProvider` at it. Clerk needs concrete CSS colors; the design guard does not scan
  `lib/`, and the file is the single deliberate literal-color bridge. `docs/AUTH.md` records
  the sync requirement.
- Verified the live sign-in page after restart. The primary Continue button is now blue with
  white text. Google is still absent because the production Clerk instance has no social
  connection; enabling it requires a custom Google OAuth client ID and secret.

### Step 26: TinyFish live-check recovery

- Root cause of "The agent check stopped unexpectedly": every worker sent
  `agent_config.max_steps: 60`. The TinyFish account is not enabled for custom max steps and
  returns HTTP 403 `FORBIDDEN`; the error code was unmapped, so the UI showed the generic
  upstream-error copy.
- Removed `max_steps` from the request. The provider default is 150 steps, and the UI now
  reports `step n of 150 max`. `max_duration_seconds: 100` and `cursor_style: "standard"`
  remain accepted. Added a `forbidden` error code with its own calm copy so an account-level
  refusal is never labelled an unexpected agent failure.
- Live verification: a direct TinyFish probe with `max_duration_seconds` and the real
  `output_schema` returned 200 and streamed STARTED, STREAMING_URL, PROGRESS, and COMPLETE.
  A real advisory worker ran through `runSwarm` with the production key and finished with
  typed findings; no key, preview URL, or upstream body was logged.
- Gate: typecheck, 481 tests, lint, and production build pass. The remaining Gap: Google
  social sign-in needs the Clerk dashboard OAuth credentials described in `docs/AUTH.md`.

### Step 27: collapsing live surfaces

- Added `components/ui/Disclosure.tsx` and `components/WorkspaceSection.tsx`. Disclosure is an
  accessible mounted body with a grid-row transition; WorkspaceSection opens a surface only
  while it carries the live work and collapses it to a real summary when settled. Closed bodies
  stay mounted and inert, so a collapse never aborts a planner stream or unmounts a preview
  frame.
- The workspace now opens only the current surface: the planning deck while sessions run,
  verification while checks run, and the route stage once checks settle. Each other surface is
  a one-line header with real counts. A reader can reopen any surface, and the mobile dock
  opens the target before scrolling to it.
- The planning deck hides agents that have settled behind one completed-agents disclosure and
  keeps only active agents in the live list. The verification body no longer repeats the status
  bar; pre-run instructions and the focused worker's sources and findings are disclosures.
- The activity rail now streams only new work: the planner shows its newest two lines with an
  earlier-updates disclosure, and verification shows its newest three with an earlier-activity
  archive.
- `TripMap` re-measures through a `ResizeObserver`, so a map inside a reopened disclosure is
  never left at a zero-size tile.
- Verified in the mock mirror at 1280 and 375: at forming the team, checks, and rail were open
  and the route and safety folded; at ready the route was the only open surface; the mobile dock
  opened Safety; no horizontal overflow; no page errors. Screenshots under
  `/tmp/collapse-*.png`.
- Gate: typecheck, 481 tests, lint, and production build pass.

### Step 28: instant cached plans and recorded verification

- Added a two-tier result cache for both agent teams. `lib/cache/cacheKey.ts` normalises the
  destination, days, condition, medication, preferences, budget, and transport into deterministic
  keys. `lib/cache/cacheStore.ts` keeps a small in-process tier over an idempotent `trip_cache`
  table in PostgreSQL. Plans live 30 days and verification 14 days.
- `/api/agent-plan` now checks the cache before it touches OpenCode. An exact hit or a
  destination + days + condition + medication fallback replays the real planner contract in one
  fast pass: `planner_started`, one result per agent, `plan_ready` with `cached`, `cachedAt`, and
  `cacheMatch`, then `planner_done`. The route adds `X-Plan-Cache: hit|miss`.
- `/api/travel-swarm` checks for a complete recorded worker set before TinyFish. A hit replays
  the real recorded purposes, sources, findings, and provenance, then `swarm_done`; it never
  reuses an expired preview URL. The route adds `X-Swarm-Cache: hit|miss`.
- The interface labels a cached result with the original date. A related planner match says the
  other preferences may differ. Cached verification keeps its recorded browser videos.
- When `TINYFISH_RECORDING=1`, the swarm runner asks TinyFish to record each run. The run-detail
  `video_url` is archived as a WebM under `$HOME/recordings` in production, and
  `/api/recordings/[id]` serves it only to a signed-in user. `FocusView` plays the recording
  after the live frame ends.
- Added `npm run cache:seed` for a verification row from an existing capture or a planner row
  from a saved JSON file, and `tests/cache-route.test.ts`, `lib/cache/*.test.ts`, and
  `lib/db/tripCache.test.ts` for keys, replay order, expiry, mock rejection, complete-set
  reads, and the PostgreSQL tier.
- Production seed for London, Ontario, 4 days, asthma, albuterol, balanced, mixed: the live
  planner finished all 7 agents in 409.5s with 4 days and 10 places; the live swarm finished
  all 3 workers in 110.1s with 25 steps, 10 sources, and 3 findings. The recording archive
  wrote three WebM files (about 1.5 MB total).
- The first exact cache hits after seeding returned the planner in 269 ms and verification in
  251 ms. A related planner request with no interests, walking transport, and a Toronto origin
  returned in 70 ms with `cacheMatch: related`; the verification hit in 69 ms. After the final
  restart, the first related planner hit was 390 ms, the verification hit was 50 ms, and a full
  signed-in onboarding click to a ready cached plan took 582 ms.
- The cached London plan now has coordinates for all 10 places. Nominatim was returning a
  Varnish 629 error in production, so `GEOCODER_FALLBACK_URL` uses Photon and
  `geocodePlan` accepts a fallback only when its city matches the destination. The cached plan
  was re-geocoded; the route map, 10 markers, and day focus are present.
- A signed-in browser run of the real onboarding flow opened the cached plan and three
  recorded WebM videos, with no page errors and no horizontal overflow at 1280 and 390. The
  recording route returned 200 `video/webm` for a 458,544-byte file.
- Gate: typecheck, 501 tests, lint, and production build pass.

### Step 29: location autocomplete and map picker

- Replaced the destination text input with `LocationField`, a controlled combobox. Typing
  debounces for 220ms and searches `/api/geocode/search`; up to six city or place rows show a
  label, provider kind, and city label, with arrow-key, Enter, Escape, and active-descendant
  support.
- Added `Use current location`, which reads the browser position and reverse-geocodes it to a
  city label through `/api/geocode/reverse`. Denied or unavailable permission leaves the typed
  city usable and shows calm copy.
- Added `Pick on map`, which opens `LocationPickerDialog`, a mounted-only Leaflet modal with a
  token-coloured DOM pin. A map click reverse-geocodes the exact point; confirm stays disabled
  until the point is named. Escape, backdrop, and focus restoration are wired.
- Added authenticated `/api/geocode/search` and `/api/geocode/reverse` routes with bounded
  queries and coordinates, private cache headers, in-process caching, Nominatim/Photon
  providers, and no raw upstream errors. Extracted shared tile configuration to `lib/mapTiles.ts`.
- Live browser checks on the signed-in production flow: typing `London` returned London,
  England first and London, Ontario, Canada second; selecting the Ontario row filled the
  canonical label. Current location with a London coordinate filled `London, Ontario, Canada`
  and showed the current-city status. A map click at the London centre resolved to
  `406 Richmond Street, London, Ontario, Canada`, enabled the confirm action, closed the
  dialog, and returned focus.
- The nginx site had `Permissions-Policy: geolocation=()`, which blocked the new control.
  Changed it to `camera=(), microphone=(), geolocation=(self)`; camera and microphone remain
  blocked. The current-location path then succeeded in the signed-in browser.
- Building from the selected autocomplete label still hit the London cache in 634-710 ms, with the
  cached plan, cached verification, 10 map markers, and 3 recorded videos. No page errors and
  no horizontal overflow at 1280 or 390; both location buttons measured 44px.
- Gate: typecheck, 522 tests, lint, and production build pass.

### Step 30: starting-point location tools

- Replaced the plain starting-point input with the same `LocationField` used for the
  destination. Origin now supports city/airport autocomplete, current location, and the exact
  map picker, while staying optional.
- Generalized the combobox and dialog copy with a field noun, so assistive labels and the map
  instruction read "destination" or "starting point" rather than one hardcoded word.
- Production browser check: the origin's current-location action filled
  `London, Ontario, Canada`; typing `Toronto` opened a list labelled "Starting point
  suggestions" with `Toronto, Ontario, Canada` first; selecting it and opening the origin map
  dialog produced the instruction to type in the starting point field, named the pin, and
  wrote `Toronto, Ontario, Canada` back to the origin. All four location controls measured
  44px, with no page errors and no horizontal overflow at 1280 or 390.
- Gate: typecheck, 522 tests, lint, and production build pass.

### Step 31: numeric duration and budget slider

- Replaced the duration range with a bounded integer field. `NumberInput` keeps an invalid
  draft out of `TripConfig`, accepts only 2-7, clamps on leaving the field, and shows the
  current value with a `days` suffix.
- Replaced the budget select with a three-stop slider. `Slider` gained optional tick labels;
  the budget track reads Value, Balanced, and Premium and announces the selected level through
  `aria-valuetext`.
- Added `clampInteger` and three unit tests for in-range, clamping, rounding, and non-finite
  input.
- Production browser check: duration rendered as `input[type=number]` with value 4, min 2,
  max 7; typing 1 clamped to 2 and 9 to 7; 5 stayed. Budget rendered as a range with
  Value/Balanced/Premium ticks, and Premium announced as `Premium budget`. The step-two review
  read "5 days in London, Ontario" and "Mixed · Premium". No horizontal overflow at 390.
- Gate: typecheck, 525 tests, lint, and production build pass.

### Step 32: consistent TinyFish recovery

- Diagnosis: the provider records showed recent runs COMPLETED, including the 04:12 pharmacy
  run created at 04:12:36, started at 04:13:41 after a 65-second queue delay, and finished at
  04:15:28 after a 107-second browser run. The app's old 120-second timer started at request
  time, so it ended before that run finished. A stream that closed before `COMPLETE` was also
  treated as a worker failure even though TinyFish had the authoritative result. The UI then
  replaced either cause with the generic `upstream_error` copy.
- Added run-record recovery: when the SSE stream ends or rejects after `STARTED`, the runner
  polls `GET /v1/runs/{id}` for the authoritative COMPLETED/FAILED record and emits the real
  completion or failure. Recording is not required for recovery.
- Added one automatic transient retry per worker for interrupted streams, network errors,
  timeouts, cancellation, rate limits, and step limits. Schema and stealth retries remain.
  A worker failure no longer aborts its siblings; each worker owns its timeout.
- Raised the client budget to 280s inside a 300s route, below the server request timeout and
  nginx's 360s read timeout. Provider queue delay and recording finalization now fit.
- The mission control shows the server's specific calm error message when a worker still fails
  after retry, instead of the generic stopped-unexpectedly line.
- Added `tests/swarm-recovery.test.ts` for early-stream recovery, recovered-failure retry, and
  one final error after two failures. Replaced the sibling-abort test with
  `tests/swarm-runner-isolation.test.ts`, proving one worker throw leaves its sibling running.
- Live worker check after deploy: the pharmacy worker for London, Ontario, albuterol started at
  04:33:41, emitted 17 progress steps, and completed at 04:35:40 (118.7s) with one finding and
  no error or retry. A full production route run for Hamilton, Ontario then completed all three
  workers in 164.6s with 38 steps, 30 sources, and 3 findings, no `worker_error`, no retry
  note, and `swarm_done` last. That run would have been cut off by the old 120s budget, which
  matches the reported failure. Recovery, retry, and final-error behavior are covered by the
  mocked recovery tests; a real provider stream was not forced to drop.
- Gate: typecheck, 528 tests, lint, and production build pass.

### Step 33: exact current starting point

- Split the current-location behavior by field. Destination still resolves to the nearest city
  label; Starting from now calls the same reverse-geocode `mode=place` path as the map picker,
  writes the exact named place, and requests high-accuracy positioning with a fresh fix.
- The starting-point status now reads "Using your current location."; the destination keeps
  "Using your current city." A failed reverse lookup tells the reader to type the location
  instead, and the map picker remains the precise fallback.
- Production check after deploy: with the simulated position at Museum London, Starting from
  filled `Museum London, London, Ontario, Canada` and showed "Using your current location.",
  rather than the city label. The destination field still uses city mode.
- Gate: typecheck, 528 tests, lint, and production build pass.

### Step 34: trips up to 20 days

- Raised `TRIP_DAYS_MAX` from 7 to 20 in the engine, planner request parser, onboarding
  normalization, and wire-plan normalizer. The duration field now accepts and clamps 2-20.
- Kept the health-score trip-length pressure saturated at seven days, so existing 2-7 day
  scores are unchanged and longer trips do not receive a new unvalidated curve. The daily
  pacing factors, recovery blocks, and per-day caps are unchanged.
- Extended the outcome contract to keep a flare day up to 20; the public form still asks only
  whether a flare occurred within seven days after the trip.
- Expanded the engine matrix to every condition x 2-20 days, updated validation and parser
  tests, and added a 20-day flare-day boundary case. The long-trip caveat is recorded in
  AGENTS.md section 12.
- Production check: the duration field rendered min 2 and max 20, the hint read "2 to 20
  days.", and typing 25 clamped to 20. With 20 days and a London destination, the step-two
  review read "20 days in London, Ontario". No horizontal overflow at 390.
- Gate: typecheck, 597 tests, lint, and production build pass.

### Step 35: cached agent recordings

- Cached plans now render `CachedRecordings` under the cached-plan callout: a closed-by-default
  archive listing the archived browser runs with one native video player per worker. The
  disclosure summary reads "3 videos · cached", so the recordings are discoverable even when
  the verification section is folded.
- The verification summary also names the recording count, and the full mission control keeps
  its existing recorded-run players. Both caches use `preload="none"`, so the archive does not
  duplicate recording requests until a reader presses play.
- Recordings remain authenticated same-origin WebM files; no live preview URL is reused.
- Production check on the cached London plan: "Recorded agent runs · 3 videos · cached" was
  visible under the cached-plan callout, the verification summary read "3 recordings", and
  opening the archive listed all three authenticated WebM sources. The first recording played
  to 2.5s with `readyState` 4 and no media error.
- Gate: typecheck, 597 tests, lint, and production build pass.

### Step 36: lean onboarding headline

- Removed the onboarding explainer paragraph, the 12-minute note, the three-item Concierge /
  Safety / Live checks list, and the duplicate planning-aid paragraph from the left column.
- The column now carries only the New trip label and the "Plan a trip that fits your body."
  headline. The persistent site footer keeps the planning-aid notice.
- Production check: the onboarding screen no longer contains the trip explainer, 12-minute
  note, three-item list, or duplicate planning-aid line; the headline remains and there is no
  horizontal overflow at 1280.
- Gate: typecheck, 597 tests, lint, and production build pass.

### Step 37: TinyFish venue evidence

- Added `lib/venue/` contracts, schemas, goals, runner, reducer, and display helpers, plus the
  authenticated `/api/venue-research` SSE route. Stay jobs use `bookingUrl ?? sourceUrl` and
  the trip dates/party; eat jobs use `menuUrl ?? sourceUrl`. At most two hotels and three
  restaurants per plan, three concurrent browsers, 75s job timeout, 45s run-record recovery,
  255s run budget, one retry, and a fallback from the preferred URL to the plan source page.
- Added timestamped `venue_activity`, source ledgers, live preview egress, per-worker clocks,
  checked-page source fallback, v2 venue cache records with recorded sources and activity
  offsets, and the place-id cache key that prevents a shared listing URL from colliding.
- Built the venue surface: four-cell run bar, keyboard venue tabs, pinned/following browser,
  one mounted live iframe per venue, Fullscreen action, merged activity, source disclosure,
  checked hotel and menu cards, checked times, and source handoffs. Checked facts also appear
  on the plan's selected-place rows and summary line.
- Onboarding now collects an optional start date and traveller count; both travel through the
  planner request and saved trips. Hotel checks need the date; menu checks do not.
- Live verification on 2026-11-22 (London, Ontario, 4 days, 2 travellers): The Park Hotel
  London returned CA$199.00 a night through Synxis, Udupi Dosa returned 12 Toast menu items,
  and Organique Cafe returned 12 menu items. Locomotive Espresso failed after its HappyCow
  listing and official site exposed no priced menu; the partial-run caution and retry stayed
  visible and the other facts remained usable. A re-run replayed the three cached records
  immediately and opened only the failed page. The live TinyFish preview iframe, per-page
  clocks, source ledger, and 24-item evidence cards rendered without page overflow at 1280px
  and 390px.
- Added pure tests for contracts, goals, formatting, reducer transitions, frame guards, cache
  collisions, legacy rows, fallback URLs, cache replay, and the authenticated route.
- Docs: `docs/VENUE.md`; register gained three venue timing/schema/TTL entries.
- Gate: typecheck, 627 tests, lint, and production build pass.

### Step 38: venue deck handoff

- The plan summary now shows the live venue counts with a "View checks" link to the venue
  deck, so the TinyFish surface is discoverable without scrolling through the whole route.
- The venue section carries scroll margin for the sticky command bar, so the jump lands with
  the heading visible.
- Gate: typecheck, 627 tests, lint, and production build pass.

### Step 39: venue heading scroll offset

- The "View checks" jump now lands on the venue heading with the sticky command bar clear of
  it. The section and heading both carry scroll margin for the fixed header.
- Gate: typecheck, 627 tests, lint, and production build pass.

### Step 40: public landing page and brand mark

- `/` now gives a signed-out visitor a public landing page and a signed-in visitor the planner.
  The landing leads with the health-first position, real product captures, the condition-gap
  statistics, the three product pillars, the route and safety views, how it works, and a
  sign-up close. Planning still requires Clerk.
- Added a pin-and-pulse brand mark in `components/Logo.tsx`, used in the header, sign-in,
  sign-up, footer, and close watermark. Added `app/icon.svg` and the generated
  `app/apple-icon.png` so the favicon and touch icon share the mark.
- Added the public header actions, the landing metadata, and real screenshots of the London
  sample trip: venue evidence, route detail, and the safety envelope. The captures are the
  only raster assets; the design guard permits them only in `components/landing/ProductShot.tsx`.
- Fixed the plan summary plural so the captured route reads "1 room quote".
- Production check: signed-out `/` returns 200 with the landing, a signed-in session still
  reaches onboarding, `/icon.svg` and `/apple-icon.png` return 200, images load, and there is
  no horizontal overflow at 1440px or 390px.
- Gate: typecheck, 628 tests, lint, and production build pass; deployed and service active.

### Step 41: Clerk Billing and Care Circle

- Market research recommended an annual-first hybrid: free safety, a $29 one-time Trip Pass,
  and a $79/year Care Circle subscription. Clerk Billing supports recurring plans only and
  this production instance does not have Clerk's separate annual-only update enabled, so the
  shipped catalog is **Free Preview ($0)** and **Care Circle ($9/month or $60/year)**.
  The lower launch price keeps the product fair for anxious patients and caregivers; $79/year
  remains a later price test.
  Annual is the default in the PricingTable and the intended plan. A true one-time Trip Pass
  remains a Stripe Checkout follow-up.
- Added the production Clerk Billing catalog via `clerk config patch`: `free_user` renamed
  Free Preview with three display features; `care_circle` with `long_trips`,
  `live_verification`, `venue_research`, `two_live_plans`, and `saved_trips_unlimited`.
  The reproducible catalog is `scripts/clerk-billing.json`.
- Added `lib/billing/plans.ts` and `lib/billing/server.ts`. Free accounts get one live plan a
  calendar year, seven days, one saved trip, no live verification, and no venue research.
  Care Circle gets two live plans a month, twenty days, unlimited saved trips, and both live
  layers. Safety, caps, cautions, and the care card stay free. Two live plans a month is 24 a
  year, so at $2-$4 of compute per live trip, heavy use can exceed the $60 annual price; the
  p95 cost needs monitoring before promotion.
- Enforced entitlements server-side in `/api/agent-plan`, `/api/travel-swarm`,
  `/api/venue-research`, and `/api/saved-trips`; the client hides or replaces paid surfaces
  with `UpgradeCallout`. Added `billing_usage` and `lib/db/billingUsage.ts` to count live
  planner runs by Clerk user, allowance period, and run id. Cache hits and mock runs do not
  consume a plan.
- Added `/pricing` with Clerk's `PricingTable`, `/account` with `UserProfile`, header/footer
  plan links, and checkout success copy. The landing hero and close now link to plans.
- Fixed a time-dependent venue-cache test that used a fixed November 22 timestamp; the
  hotel quote expired before the test ran on November 23.
- Tests: 640 total. Added entitlement mapping, paid-plan detection, missing-feature caps,
  throwing-`has()` fallback, monthly and yearly period starts, run-id idempotence, and
  cross-user isolation. Database usage tests skip without `DATABASE_URL`.
- Gate: typecheck, 605 passed / 35 skipped, lint, and production build pass. Applied the
  `billing_usage` schema to production. Production smoke: `/` 200 landing, `/pricing` 200,
  `/account` redirects signed-out users to `/sign-in`, `/api/saved-trips` 401, and the Clerk
  Frontend API 200. A headless browser rendered Free Preview and Care Circle, annual selected
  by default ($5.00/month billed annually, $60/year), with no console errors.
- Unverified: a real paid checkout with a card, a signed-in Care Circle session exercising
  all three gates, invoice/cancellation flow, and the annual-only cleanup after the Dashboard
  update is enabled.

### Step 42: reliable account links

- Pricing, sign-in, saved-trip, model, and brand links now use full-page anchors instead of
  client-side `Link` transitions. A stale client router or a Clerk billing chunk can no longer
  trap a click; opening the destination in a new tab was the workaround, not the intended UX.
- `LinkButton` now detects internal targets (`/` or `#`) and keeps them in the same tab even
  when the caller leaves `external` at its default. This fixes internal account, pricing, and
  saved-trip buttons that previously opened a new tab.
- Header links gained padded hit areas, `whitespace-nowrap`, and a local stacking context.
- Verified with a real pointer click: the Pricing header link navigates to `/pricing` in the
  same tab with no target attribute.
- Gate: typecheck, 640 tests, lint, and production build pass; deployed and service active.

## Production consumer reset (2026-11-25)

- **Direction.** Reset the product from a patient/caregiver clinical planner to health-aware
  trip planning for consumers. Remove medication, Sun Life insurance, pharmacy, coverage, the
  three-worker verification model, and the recording archive. Keep the safety envelope, care
  card, saved trips, venue evidence, and the consented calibration loop.
- **Worktrees and agents.** The reset landed on `main` through 50a5db5. Separate worktrees
  carried the core reset, backend, privacy, workspace, destination-check, onboarding, landing,
  site, and documentation work; the docs branch changed no application code or tests.
- **Core reset (`10b22db`).** Removed medication, insurance, pharmacy, and coverage from the
  engine input, planner prompts, dossier, cache signature, workers, copy, and tests. Replaced
  the three-worker TinyFish swarm with one destination advisory worker. Deleted
  `lib/sunLifeRules.ts`, the pharmacy and coverage goals, and the multi-worker mission control.
- **Positioning and landing (`e896b02`, `01a5254`, `396a1b2`).** Repositioned the product as
  health-aware trip planning. The landing leads with the trip, the route, checked places, and
  the safety envelope rather than a clinical claim. Pricing, trust, support, error boundaries,
  tap targets, and feedback focus were polished; the footer links privacy and terms.
- **Onboarding (`31f1045`).** Rebalanced into 01 The trip and 02 Your pace. The health profile
  is explicit and starts empty; duration is capped by the plan; start date, travellers, budget,
  transport, preferences, and the plan allowance are on the form. The review sentence names
  the included live plans without inventing a remaining count.
- **Workspace (`fcfc6bb`, `5c20406`).** Added the "Checked places" section, kept "Pacing and
  safety" open at ready, defaulted the map to all days, simplified the command bar and dock,
  moved the outcome form into a disclosure, and made saved-trip venue refresh explicit. Saved
  trips now paginate with Older/Newer, ask for a second delete confirmation, and handle the
  free saved-trip limit.
- **Destination check (`6f95564`, `5c20406`).** One calm surface for the Government of Canada
  advisory: pre-run row, status card, optional live view, source-backed findings, checked date,
  stale-input caution, and retry. No raw JSON, step count, tempo strip, provider internals, or
  invented partial findings.
- **Backend hardening (`c86dd22`, `4d4a844`).** Added atomic billing reservations that fail
  closed, date/party-safe plan cache identity, cached plans that never write dossiers, the
  live kill switch, per-account and global concurrency guards, cooldowns, the venue daily cap,
  the geocoder minute budget, public venue URL validation, database statement/query timeouts,
  and bounded two-second waits for best-effort writes.
- **Privacy and recordings (`e269b5c`).** Removed the recording archive, `/api/recordings`,
  the recording environment variables, and the install-scoped `GET /api/trips` log. Added
  `/privacy`, `/terms`, and account deletion. The deletion route removes `saved_trips` and
  `billing_usage`, then the Clerk user; anonymous captures are not linked and stay separate.
- **Auth and site.** Return paths are validated through `signInHref`; signed-out `/` renders
  the landing page instead of redirecting. Clerk Billing copy was updated in
  `scripts/clerk-billing.json` ("Live destination check", "Live menus and room rates") and the
  applied catalog is recorded in `docs/BILLING.md`.
- **Final polish (`19689ee`, `f8d4180`, `490648d`, `b30f09e`).** Clarified that clearing local
  storage does not delete an anonymous capture already stored, kept hospital guidance to the
  first day instead of every checkpoint, linked the terms and privacy notice from sign-up,
  and aligned the investor deck with the consumer product. The docs branch was then merged.
- **General relaxation default.** Added `general_wellness` as the first health profile and the
  onboarding default: "relaxation and stress recovery", with a modeled 10,000-step / 6 km
  ceiling, a 30-minute recovery window, and a 10/100 residual-risk floor. The synthetic cohort
  and artifact were regenerated so the demo includes the profile (`synthetic-5e24db31`,
  Brier 0.1383 against the engine's 0.1458); the artifact remains synthetic-only and never
  drives a live cap.
- **Docs.** AGENTS.md, AUTH.md, BILLING.md, ML.md, VENUE.md, PITCH.md, and `.env.example` now
  describe the consumer product, the live limits, the destination check, account deletion,
  privacy, and the removed recording surface. This section is the reset's build record.
- **Gate.** `npm run typecheck`, `npm test`, and `npm run lint` pass. The suite reports 702
  tests: 663 passed and 39 skipped without `DATABASE_URL`. `next build` also passes.
- **Build and deploy.** `main` was pushed to `origin` and
  `/usr/local/bin/planmytrip-deploy.sh --force` reported deploy OK at 2026-11-25 04:44. The
  service is active, `.deploy-sha` is 50a5db5, and the local health probe returns `ok` with
  database, TinyFish, Clerk, OpenCode, and cache checks true. `/`, `/pricing`, `/privacy`,
  `/terms`, `/sign-up`, `/model`, and `/pitch` return 200 on the local probe; external reader
  fetches of `/` and `/pricing` show the new copy. Host-originated HTTPS checks are blocked by
  the ops nginx ban list for this server's own IP, so external verification used a reader
  proxy. Recording files and the two recording variables were removed from production.

## Next action

Smoke account deletion with a real signed-in account, and confirm the `/privacy` and `/terms`
pages in a normal browser at 390px and 1280px. Run one live 7-agent planner pass plus the
single destination check and record the completed and failed agents, the advisory findings, and
the wall clock. Run a real Care Circle checkout with a card and verify the session plan, a
20-day plan, the live destination check, venue research, unlimited saved trips, and the
account-deletion path. Get legal review of privacy and terms before a paid pilot. Run the
database-backed billing reservation and account-deletion tests against staging PostgreSQL.
Confirm the monthly toggle is acceptable or enable Clerk's Annual-only plans update and set
`amount` to `0`. Decide whether the $29 one-time Trip Pass needs Stripe Checkout. Measure
conversion, compute cost per paid trip, cancellation reasons, and renewal intent. Review the
host-originated nginx ban entry for this server's own IP so operators can run public HTTPS
smoke checks without a proxy.
