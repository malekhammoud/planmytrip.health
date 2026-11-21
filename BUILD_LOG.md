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
- **Sun Life stability window:** not supplied; a named placeholder and `// VERIFY:` will
  be added with `SUN_LIFE_RULES` in Step 4. It will not be presented as policy.
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

## Next action

Step 2: build `components/ui/*` primitives (parallel with Steps 3 and 4), run the full
gate, review, merge docs, commit `feat(ui): add design system primitives`.
