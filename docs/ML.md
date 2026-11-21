# The data loop and the flare calibration model

This document explains the asset this branch builds: a consented, longitudinal record of
**a prescribed travel dose, what happened, and how the traveler felt**. The model is the
small machine that turns those labels into a safer estimate. The labels are the moat.

## 1. The asset, in one paragraph

Every other travel planner stops at the itinerary. Every other health app stops at the
symptom. This product owns both ends of the same trip: the engine prescribes a biological
dose (steps, walking, exertion, recovery), the concierge turns it into real days, the
traveler records whether a flare happened, and the pair is stored together under a
versioned contract. That person-day, condition-labeled dose-response corpus does not
exist today. It cannot be scraped, bought, or inferred from activity data because only
this product knows what dose was prescribed.

## 2. What one record contains

`lib/data/types.ts` defines the versioned contract.

| Record | Fields |
| --- | --- |
| Request | destination, days, condition, medication name, interests, budget, coverage |
| Engine | health safety score, baseline score, risk reduction, daily ceiling, engine dose |
| Plan | source (concierge or fallback), computed dose, degraded flag, mock flag |
| Verification | bounded specialist summaries and TinyFish findings |
| Features | peak exposure, recovery coverage, trip length, adherence, heat, altitude, baseline burden |
| Consent | explicit capture flag, consent version, timestamp |
| Outcome | flare yes/no, flare day, severity, care sought, self-reported adherence, notes |

Two rules keep the corpus comparable:

- **Every dose is computed from plan blocks.** `stepEstimate` and `walkingKm` from the
  concierge are ignored; they are shown as an agent estimate, never used as a label.
- **Every version travels with the row.** `schemaVersion`, `engineVersion`, and the model
  version are stored so a future engine change does not silently change the meaning of
  old rows.

## 3. Why the dose is computed

There are two plan families, and they used to be incomparable:

| | Engine | Concierge |
| --- | --- | --- |
| Block kinds | acclimation, cultural, recovery, meal, transit | transit, stay, meal, visit, hike, rest, care |
| Exertion | typed 1-3 | absent |
| Load | `modelDayLoad` | agent self-report |

`lib/data/dose.ts` bridges them. It maps concierge kinds to exertion, raises hike
exertion from verified distance, elevation, and difficulty, counts walking kinds only, and
uses the same `stepsPerExertionMinute` and `kmPerStep` assumptions as the engine. The
result is a `PlannedDose` per day with steps, walking, active minutes, exertion-weighted
minutes, recovery minutes, the engine ceiling, and a `withinCaps` flag.

An empty day is never safe. A rest day with a real recovery block may legitimately carry
zero steps. Both cases are tested.

## 4. The model

`lib/model/` is dependency-free TypeScript. It is a **calibration layer**, not a
from-scratch predictor.

```
p_engine = clamp((100 - healthSafetyScore) / 100, 0.01, 0.99)
offset   = logit(p_engine)

η = offset + β0 + β1·peakExposure + β2·recoveryCoverage + β3·tripLength
p = σ(η)
p_calibrated = isotonic(p)
```

- With zero labels, `β = 0`, so the model is exactly the engine.
- The engine encodes physiology; the model learns the residual.
- `lib/model/logistic.ts` fits the MAP estimate with Newton-Raphson/IRLS, Gaussian priors,
  and a Laplace covariance. No library, no service.
- `lib/model/calibration.ts` fits an isotonic map with PAVA, so a higher predicted risk can
  never be calibrated lower. It also computes Brier, log loss, ECE, AUROC, and the
  calibration slope.
- `lib/model/predict.ts` returns `pFlare`, a 90% interval from the covariance, the sample
  size, and an evidence tier.

Training is pipeline version 2. Each fold's standardization and coefficients are fitted on
that fold's training rows only, and an inner grouped cross-validation fits the isotonic map
before it scores the outer fold. The artifact records `pipelineVersion`; the loader refuses
any other version, a zero-row artifact, or an artifact trained for another engine version,
so a stale or truncated file falls back to the deterministic engine rather than a learned
probability.

### Tiers

| Tier | Condition |
| --- | --- |
| `engine` | Fewer than 50 labeled trips, or no real artifact |
| `synthetic` | Trained on the demo cohort; never used live |
| `pooled` | At least 50 real labels |
| `condition` | At least 200 labels for that condition |

A synthetic artifact is visible on `/model` but cannot change a live plan. When real data
arrives, the learned model may only **tighten** a cap, never widen it above the profile
ceiling.

## 5. Training

The weekend pipeline is deliberately small:

```bash
npm run db:init          # apply the idempotent Postgres schema
npm run data:synthetic   # deterministic cohort -> JSONL + optional Postgres seed
npm run data:export      # labeled Postgres rows -> data/training-rows.jsonl
npm run model:train      # JSONL -> lib/model/model.json + docs/MODEL_CARD.md
npm run model:demo       # data:synthetic then model:train
npm run model:train -- --input data/training-rows.jsonl --source outcomes
```

`scripts/synthetic.ts` generates a seeded cohort with a known logistic dose-response,
condition effects, noisy self-reported steps, and an 18-22% flare rate. It writes:

- `data/synthetic-trips.jsonl` — one `TrainingRow` per trip.
- When `DATABASE_URL` is set, the same full dossiers and outcomes are inserted into
  PostgreSQL for inspection. They are mock-flagged, so `npm run data:export` intentionally
  returns zero rows from the demo seed. Without `DATABASE_URL` it writes the JSONL only.

`scripts/export-training.ts` reads only explicitly labeled PostgreSQL rows and writes
`data/training-rows.jsonl` (gitignored because it may contain real outcomes). Mock plans,
rows under another data schema, and rows written by another engine version are excluded;
their offsets or provenance mean something different. Train it with `--source outcomes`;
the artifact version becomes `outcomes-<hash>` and the tier gate decides whether it is
`engine`, `pooled`, or `condition`.

`scripts/train-model.ts` reads the JSONL, trains, evaluates nested out-of-fold predictions,
writes the artifact and model card, and records a `model_runs` row when `DATABASE_URL` is
set. Folds are grouped by `userId`, so one install never leaks across train and validation.
The synthetic cohort marks every row with `synthetic: true`; both the CLI and `trainModel`
refuse to label that cohort `--source outcomes`, so a demo file cannot become observed
evidence by a mistyped flag.

The artifact is a JSON file, not a service:

```
lib/model/model.json
```

It stores feature means/stds, coefficients, the Laplace covariance, the isotonic knots,
the training counts by condition, the data hash, and the metrics. Inference is a dot
product plus a lookup.

## 6. Evaluation and ship gate

The reported numbers are genuinely nested out-of-fold: feature scaling, logistic
coefficients, and the isotonic map for each outer fold are all fitted without that fold's
labels. The script refuses a cohort with fewer than 20 rows, fewer than two flares, or
fewer than two non-flares.

A real artifact ships only when:

1. Brier score beats the engine-only Brier on grouped folds.
2. Expected calibration error is under 0.05.
3. The calibration slope stays near 1.
4. Each condition has enough labels for the tier it claims.

The synthetic artifact currently reports a modest Brier improvement (0.1612 against the
engine's 0.1674), ECE 0.0238, and AUROC 0.6620. That is expected: the engine offset already
carries most of the signal. The point is calibration and the pipeline, not a headline AUC.

## 7. Storage

`lib/db/postgres.ts` uses a parameterized `pg` pool. The schema is idempotent and is applied
by `npm run db:init` or lazily before the first query. `DATABASE_URL` is the only connection
setting; `DATABASE_SSL=true` enables TLS with certificate validation. Use
`NODE_EXTRA_CA_CERTS` for a private CA rather than disabling verification.

```
trip_captures
  run_id (primary key), install_id, schema_version, engine_version, created_at,
  consent_version, request_json jsonb, engine_json jsonb, plan_json jsonb,
  dose_json jsonb, features_json jsonb, research_json jsonb, swarm_json jsonb,
  outcome_json jsonb, label_flare boolean, label_severity, label_care,
  label_flare_day, outcome_at

model_runs
  model_version (primary key), trained_at, schema_version, source, n, events,
  metrics_json jsonb, artifact_json jsonb
```

- The planner route writes the dossier when `plan_ready` fires; the stream waits for the
  best-effort write before closing.
- The swarm route writes a stub or updates findings when `swarm_done` fires.
- The outcome route requires the same `runId` and `installId`; another browser cannot
  overwrite the label.
- `exportTrainingRows()` returns only rows with an explicit label, excludes mock plans,
  and accepts only the current data schema and engine version.
- A repeated run id cannot move to another install: the conflict update is scoped to the
  original install id.

Production uses its own `DATABASE_URL` in `/etc/planmytrip.env`. Local development uses
`planmytrip_dev`; tests use `planmytrip_test` and skip database files when `DATABASE_URL` is
absent. The password is never committed or rendered in the app.

## 8. Consent and privacy

Capture is opt-in on the health step of onboarding. The copy says:

> Save this trip anonymously to improve pacing estimates. No name, email, or account.
> You can record the outcome after your trip, and that is what calibrates future
> estimates.

The only identity is a random install id in `localStorage`. There is no account, cookie,
email, IP log, or free-text transcript. The public outcome route ignores `notes`, so a
client cannot store free text through it. The outcome is an explicit yes or no; the
interface requires an answer rather than treating an untouched checkbox as a negative, and
an unanswered follow-up is not a negative and is excluded from training.

Before charging users, this needs a privacy review, retention policy, and a clear
statement of the model provider and geocoder data flows. Treat the database as a clinical
asset, because it is one.

## 9. Current status

- The model is trained on **synthetic** trips. It is a pipeline demonstration.
- The committed artifact is `synthetic-5a38cf18` on pipeline 2: Brier 0.1612 against the
  engine's 0.1674, ECE 0.0238, AUROC 0.6620, calibration slope 0.9549. The committed
  cohort, artifact, and model card are reproducible and guarded by tests.
- The full app gate passes: typecheck, the test database suite, lint, and production build.
  Database suites skip cleanly when `DATABASE_URL` is absent.
- The capture routes are tested end to end with mock planner and swarm runs, and the
  consented loop (capture, explicit outcome, export, train, predict) has an integration
  test against PostgreSQL.
- One consented production browser trip is currently stored without an outcome, so it is
  excluded from training. The browser-test rows used to verify capture, dose, and the explicit
  outcome were removed after verification; the committed artifact remains synthetic.
- There is no authentication or rate limiting; the store is a single PostgreSQL database
  with no retention job or deletion endpoint yet.

## 10. Scale-up ladder

| Labeled trips | Model | What unlocks |
| --- | --- | --- |
| 0 | Engine only | Current behavior |
| 50-200 per condition | Pooled isotonic calibration | Observed flare rate by risk band |
| 300-500 | Three-feature residual model | Exposure and recovery adjustments |
| 1,000+ | Add adherence, heat, altitude, baseline; condition intercepts | Finer personalization |
| 2,000+ person-days | Discrete-time hazard | Daily risk and adaptive re-planning |
| 5-10 trips per user | User random effect | Personal ceiling |

Retraining is offline. The artifact format and inference interface stay the same at every
rung.

## 11. Failure modes to watch

- **Selection bias.** Travelers who flare are more likely to answer. Send the follow-up to
  everyone, compare responders with non-responders, and treat the estimate as biased until
  measured.
- **Self-report noise.** Define flare in plain language and adjudicate a sample with a
  clinician.
- **Confounding.** Adherence is not random. The model is predictive, not causal.
- **Engine drift.** A new engine version changes the offset. Record `engineVersion` and
  recalibrate.
- **Distribution shift.** Destinations and seasons change. Monitor calibration by
  condition and by month.
- **Leakage.** Never split by row; split by traveler. The scaler, coefficients, and
  isotonic map each need a training-only fit.
- **Calibrator leakage.** An isotonic map fitted on the same out-of-fold scores it later
  scores reports an optimistic ECE. Pipeline 2 uses an inner grouped cross-validation for
  every outer fold; do not simplify that away.
- **A synthetic artifact in production.** The tier gate, the engine-version check, the
  `synthetic` cohort marker, and the export filters all refuse it. Do not remove them.

## 12. Repo map

```
lib/data/      types.ts, dose.ts, tripDossier.ts, capture.ts, validation.ts
lib/db/        postgres.ts, trips.ts
lib/model/     math.ts, features.ts, logistic.ts, calibration.ts, train.ts,
               predict.ts, artifact.ts, model.json, types.ts
scripts/       db-init.ts, export-training.ts, synthetic.ts, train-model.ts
app/api/       agent-plan (capture writer), travel-swarm (capture writer),
               trips, trips/outcome
app/model/     the model card and illustrative curve
docs/          ML.md, MODEL_CARD.md (generated)
data/          synthetic-trips.jsonl (committed); PostgreSQL holds live rows
```
