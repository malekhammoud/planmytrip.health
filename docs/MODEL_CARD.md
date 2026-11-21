# Model card: flare calibration

- **Version:** `synthetic-5a38cf18`
- **Trained:** 2026-11-21T21:26:46.703Z
- **Source:** synthetic
- **Engine version:** 1
- **Pipeline version:** 2
- **Data hash:** `5a38cf183b825e452a0f4d6bb5b0727b1dba460f1810d909e13f17c3604159ef`

## What this is

A calibration layer on top of the deterministic pacing engine. It estimates the
probability that a traveler reports a flare during the trip or within seven days after.
The engine's modeled risk is the prior log-odds; the model learns the residual.

**This artifact was trained on synthetic trips. It is a pipeline demonstration, not clinical evidence, and it is never used to change a live safety cap.**

## Intended use

- Validate the training, calibration, and evaluation pipeline.
- Show how coefficients and reliability change as labeled trips arrive.
- Provide an auditable artifact for a future real-data retrain.

## Not intended for

- Diagnosis, treatment, medication changes, or individual medical advice.
- Clinical validation claims.
- Relaxing an engine cap. The learned model may only tighten, never widen, the
  deterministic envelope; in this build it does not change caps at all.

## Data

| Item | Value |
| --- | --- |
| Labeled trips | 900 |
| Flares | 195 (21.7%) |
| Mean engine offset | -0.926 |

| Condition | Trips | Flares |
| --- | --- | --- |
| asthma_respiratory | 186 | 34 |
| chronic_fatigue_pots | 188 | 57 |
| pregnancy_second_trimester | 165 | 23 |
| severe_food_allergy | 173 | 32 |
| cardiac_hypertension | 188 | 49 |

## Features and coefficients

Features are standardized with the stored mean and standard deviation. A coefficient is
the change in log-odds for one standard deviation, holding the engine offset fixed.

| Feature | Coefficient |
| --- | --- |
| `intercept` | -0.467 |
| `peakExposure` | 0.312 |
| `recoveryCoverage` | -0.059 |
| `tripLength` | 0.249 |

## Out-of-fold performance

| Metric | Value |
| --- | --- |
| Brier score | 0.1612 |
| Engine-only Brier | 0.1674 |
| Log loss | 0.4966 |
| Expected calibration error | 0.0238 |
| AUROC | 0.6620 |
| Calibration slope | 0.9549 |

Folds are grouped by `userId`, so one synthetic traveler never appears in both
training and validation. Each fold's feature scaling and logistic coefficients are fitted on that
fold's training rows only. For each outer fold, an inner grouped cross-validation inside
the training rows fits the isotonic map before it scores the outer fold. Brier, log loss,
and calibration error are therefore nested out-of-fold estimates, not in-sample scores for
the calibrator.

## Isotonic calibration

| Raw probability | Calibrated probability |
| --- | --- |
| 0.049 | 0.000 |
| 0.060 | 0.000 |
| 0.064 | 0.000 |
| 0.067 | 0.000 |
| 0.070 | 0.000 |
| 0.073 | 0.000 |
| 0.078 | 0.000 |
| 0.081 | 0.000 |
| 0.157 | 0.183 |
| 0.443 | 0.500 |
| 0.540 | 0.571 |

The map is flat at zero below the lowest observed event rate, then rises with the
predicted probability. A calibrated zero means the synthetic cohort produced no flares
in that band, not that a real trip is impossible.

## Limitations

- Synthetic dose-response, synthetic adherence, and synthetic outcomes.
- No real trip has contributed a label.
- Self-reported flares are noisy; a real cohort needs explicit negatives and a
  responder-bias check.
- Coefficients are predictive, not causal.
- The model is pooled across conditions in v0. Condition intercepts wait for at least
  50 labeled trips per condition.
- Recalibrate after any engine version change.

## Retraining

```bash
npm run data:synthetic
npm run model:train
```

Real outcomes export from Postgres with `exportTrainingRows()` in `lib/db/trips.ts`.
The artifact is versioned; a new engine version requires a new artifact.
