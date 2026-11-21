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
- Gate: typecheck, 233 tests, lint, production build pass. Browser checks: 375/1280 layout,
  mock concierge run, 13 numbered map markers, 44px marker hit areas, five legend dots, map
  key, bottom-left attribution, plan-above-roster view, no console errors. A stale Turbopack
  stylesheet cache hid the new legend until `.next` was cleared. The dev server re-added the
  Next.js agent-rules block to AGENTS.md.
- Unverified: live re-run of the hardened JSON parser and geocode fallback, a 7-of-7 live
  agent pass, full live map rendering, production tile/Nominatim licences, and a real OpenCode
  service supervised in production.

## Next action

Run a full 7-of-7 live concierge pass with the hardened JSON parser and geocode fallback;
confirm stay, transit, and care parse, a geocoded marker appears, and the map renders. Then run
the full three-worker TinyFish pass and confirm the live iframe preview and clipboard behavior.
The clinical thresholds and Sun Life stability window remain VERIFY.
