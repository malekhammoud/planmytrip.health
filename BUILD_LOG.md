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

## Next action

Run a consented pilot cohort against production PostgreSQL, confirm capture and outcome rows
arrive, and replace the synthetic artifact only after the pooled tier is reached. Monitor
pharmacy consistency and check the live iframe and clipboard behavior. The clinical thresholds
and Sun Life stability window remain VERIFY.
