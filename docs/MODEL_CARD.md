# Model card: flare calibration

- **Version:** `synthetic-5e24db31`
- **Trained:** 2026-11-25T22:00:23.786Z
- **Source:** synthetic
- **Engine version:** 1
- **Pipeline version:** 2
- **Data hash:** `5e24db31922dc644a6981eba44de90b035ec76154b83d723cee45865b566b384`

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
| Flares | 154 (17.1%) |
| Mean engine offset | -1.050 |

| Condition | Trips | Flares |
| --- | --- | --- |
| general_wellness | 153 | 13 |
| asthma_respiratory | 134 | 15 |
| chronic_fatigue_pots | 142 | 35 |
| pregnancy_second_trimester | 158 | 17 |
| severe_food_allergy | 157 | 30 |
| cardiac_hypertension | 156 | 44 |

## Features and coefficients

Features are standardized with the stored mean and standard deviation. A coefficient is
the change in log-odds for one standard deviation, holding the engine offset fixed.

| Feature | Coefficient |
| --- | --- |
| `intercept` | -0.616 |
| `peakExposure` | 0.232 |
| `recoveryCoverage` | -0.170 |
| `tripLength` | 0.057 |

## Out-of-fold performance

| Metric | Value |
| --- | --- |
| Brier score | 0.1383 |
| Engine-only Brier | 0.1458 |
| Log loss | 0.4489 |
| Expected calibration error | 0.0190 |
| AUROC | 0.6339 |
| Calibration slope | 0.8676 |

Folds are grouped by `userId`, so one synthetic traveler never appears in both
training and validation. Each fold's feature scaling and logistic coefficients are fitted on that
fold's training rows only. For each outer fold, an inner grouped cross-validation inside
the training rows fits the isotonic map before it scores the outer fold. Brier, log loss,
and calibration error are therefore nested out-of-fold estimates, not in-sample scores for
the calibrator.

## Isotonic calibration

| Raw probability | Calibrated probability |
| --- | --- |
| 0.025 | 0.000 |
| 0.036 | 0.000 |
| 0.038 | 0.000 |
| 0.040 | 0.000 |
| 0.066 | 0.084 |
| 0.137 | 0.118 |
| 0.172 | 0.176 |
| 0.231 | 0.219 |
| 0.241 | 0.250 |
| 0.408 | 0.429 |

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
