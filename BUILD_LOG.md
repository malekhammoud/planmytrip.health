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
- **TinyFish:** no key exists locally and the live API is never called. Tests and
  `SWARM_MOCK=1` are the verification paths.

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

## Next action

Review and commit Step 4 (`feat(api): add parallel 3-worker TinyFish SSE swarm`). Then
build Step 5 (header, rail, page layout) alone, review it, wire Steps 6 and 7 next.
