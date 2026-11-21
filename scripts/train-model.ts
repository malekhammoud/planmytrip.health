/**
 * Trains the calibration artifact from a labeled JSONL cohort.
 *
 * Inputs: --input, --out, --card, --folds, --features, and optional DATABASE_URL.
 * Outputs: lib/model/model.json, docs/MODEL_CARD.md, and a Postgres model_runs row.
 * Invariants: the data hash is recorded; a synthetic artifact is labelled synthetic; the
 * script refuses to train on fewer than 20 rows or a single class.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { isCondition } from "../lib/types";
import type { TrainingRow, TripFeatures } from "../lib/data/types";
import { ENGINE_VERSION } from "../lib/data/types";
import { closeDatabase } from "../lib/db/postgres";
import { recordModelRun } from "../lib/db/trips";
import { trainModel } from "../lib/model/train";
import {
  V0_FEATURES,
  V1_FEATURES,
  type FeatureName,
  type ModelArtifact,
} from "../lib/model/types";

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function integerOption(name: string, fallback: number): number {
  const value = Number.parseInt(option(name, String(fallback)), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function features(value: unknown): TripFeatures | null {
  if (!isRecord(value)) return null;
  const numbers = ["peakExposure", "recoveryCoverage", "tripLength"] as const;
  for (const key of numbers) {
    if (typeof value[key] !== "number" || !Number.isFinite(value[key])) return null;
  }
  return value as unknown as TripFeatures;
}

function parseRow(value: unknown): TrainingRow | null {
  if (!isRecord(value)) return null;
  if (typeof value.runId !== "string" || typeof value.userId !== "string") return null;
  if (!isCondition(value.condition)) return null;
  if (typeof value.offset !== "number" || !Number.isFinite(value.offset)) return null;
  if (value.label !== 0 && value.label !== 1) return null;
  if (typeof value.days !== "number" || !Number.isFinite(value.days)) return null;
  const parsedFeatures = features(value.features);
  if (parsedFeatures === null) return null;
  return {
    runId: value.runId,
    userId: value.userId,
    condition: value.condition,
    features: parsedFeatures,
    offset: value.offset,
    label: value.label,
    days: value.days,
    ...(value.synthetic === true ? { synthetic: true as const } : {}),
  };
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function number(value: number, digits = 3): string {
  return value.toFixed(digits);
}

function coefficient(artifact: ModelArtifact, name: string): number {
  if (name === "intercept") return artifact.coefficients.intercept;
  return artifact.coefficients[name as FeatureName] ?? 0;
}

function modelCard(artifact: ModelArtifact): string {
  const coefficientRows = ["intercept", ...artifact.featureNames]
    .map((name) => `| \`${name}\` | ${number(coefficient(artifact, name))} |`)
    .join("\n");
  const conditionRows = Object.entries(artifact.training.byCondition)
    .map(([condition, counts]) => `| ${condition} | ${counts.n} | ${counts.events} |`)
    .join("\n");
  const calibrationStep = Math.max(
    1,
    Math.ceil(artifact.calibration.length / 10),
  );
  const calibrationRows = artifact.calibration
    .filter(
      (_, index) =>
        index === 0 ||
        index === artifact.calibration.length - 1 ||
        index % calibrationStep === 0,
    )
    .map((point) => `| ${number(point.x)} | ${number(point.y)} |`)
    .join("\n");
  const synthetic = artifact.source === "synthetic";
  const evidence = synthetic
    ? "**This artifact was trained on synthetic trips. It is a pipeline demonstration, not clinical evidence, and it is never used to change a live safety cap.**"
    : "**This artifact was trained on consented traveler outcomes. It is observational, not clinical validation, and it may only tighten a live safety cap.**";
  const foldsText = synthetic
    ? "Folds are grouped by `userId`, so one synthetic traveler never appears in both\ntraining and validation."
    : "Folds are grouped by `userId`, so one install never appears in both training and\nvalidation.";
  const cohortText = synthetic ? "synthetic cohort" : "observed cohort";
  const limitationsIntro = synthetic
    ? "- Synthetic dose-response, synthetic adherence, and synthetic outcomes.\n- No real trip has contributed a label."
    : "- Consented, self-reported outcomes; not a controlled clinical cohort.";
  return `# Model card: flare calibration

- **Version:** \`${artifact.modelVersion}\`
- **Trained:** ${artifact.trainedAt}
- **Source:** ${artifact.source}
- **Engine version:** ${artifact.engineVersion}
- **Pipeline version:** ${artifact.pipelineVersion}
- **Data hash:** \`${artifact.training.dataHash}\`

## What this is

A calibration layer on top of the deterministic pacing engine. It estimates the
probability that a traveler reports a flare during the trip or within seven days after.
The engine's modeled risk is the prior log-odds; the model learns the residual.

${evidence}

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
| Labeled trips | ${artifact.training.n} |
| Flares | ${artifact.training.events} (${percent(artifact.training.events / Math.max(1, artifact.training.n))}) |
| Mean engine offset | ${number(artifact.training.meanOffset)} |

| Condition | Trips | Flares |
| --- | --- | --- |
${conditionRows}

## Features and coefficients

Features are standardized with the stored mean and standard deviation. A coefficient is
the change in log-odds for one standard deviation, holding the engine offset fixed.

| Feature | Coefficient |
| --- | --- |
${coefficientRows}

## Out-of-fold performance

| Metric | Value |
| --- | --- |
| Brier score | ${number(artifact.metrics.brier, 4)} |
| Engine-only Brier | ${number(artifact.metrics.baselineBrier, 4)} |
| Log loss | ${number(artifact.metrics.logLoss, 4)} |
| Expected calibration error | ${number(artifact.metrics.ece, 4)} |
| AUROC | ${number(artifact.metrics.auroc, 4)} |
| Calibration slope | ${number(artifact.metrics.calibrationSlope, 4)} |

${foldsText} Each fold's feature scaling and logistic coefficients are fitted on that
fold's training rows only. For each outer fold, an inner grouped cross-validation inside
the training rows fits the isotonic map before it scores the outer fold. Brier, log loss,
and calibration error are therefore nested out-of-fold estimates, not in-sample scores for
the calibrator.

## Isotonic calibration

| Raw probability | Calibrated probability |
| --- | --- |
${calibrationRows}

The map is flat at zero below the lowest observed event rate, then rises with the
predicted probability. A calibrated zero means the ${cohortText} produced no flares
in that band, not that a real trip is impossible.

## Limitations

${limitationsIntro}
- Self-reported flares are noisy; a real cohort needs explicit negatives and a
  responder-bias check.
- Coefficients are predictive, not causal.
- The model is pooled across conditions in v0. Condition intercepts wait for at least
  50 labeled trips per condition.
- Recalibrate after any engine version change.

## Retraining

\`\`\`bash
npm run data:synthetic
npm run model:train
\`\`\`

Real outcomes export from Postgres with \`exportTrainingRows()\` in \`lib/db/trips.ts\`.
The artifact is versioned; a new engine version requires a new artifact.
`;
}

async function main(): Promise<void> {
  const input = resolve(option("--input", "data/synthetic-trips.jsonl"));
  const output = resolve(option("--out", "lib/model/model.json"));
  const card = resolve(option("--card", "docs/MODEL_CARD.md"));
  const folds = integerOption("--folds", 5);
  const featureSet = option("--features", "v0");
  const source = option("--source", "synthetic");
  if (source !== "synthetic" && source !== "outcomes") {
    throw new Error("--source must be synthetic or outcomes");
  }
  const featureNames: FeatureName[] =
    featureSet === "v1" ? [...V1_FEATURES] : [...V0_FEATURES];

  const raw = readFileSync(input, "utf8");
  const rows = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      try {
        const parsed = parseRow(JSON.parse(line));
        return parsed === null ? [] : [parsed];
      } catch {
        return [];
      }
    });
  if (rows.length === 0) throw new Error(`no valid training rows in ${input}`);
  if (source === "outcomes" && rows.some((row) => row.synthetic === true)) {
    throw new Error(
      "refusing to label the synthetic cohort as observed outcomes; export real rows with npm run data:export",
    );
  }

  const dataHash = createHash("sha256").update(raw).digest("hex");
  const artifact = trainModel(rows, {
    featureNames,
    folds,
    source,
    modelVersion: `${source}-${dataHash.slice(0, 8)}`,
    trainedAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
    dataHash,
  });

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(artifact, null, 2)}\n`);
  mkdirSync(dirname(card), { recursive: true });
  writeFileSync(card, modelCard(artifact));

  if (process.env.DATABASE_URL?.trim()) {
    await recordModelRun(artifact);
    await closeDatabase();
    console.log("model run: recorded in Postgres");
  } else {
    console.log("model run: skipped (DATABASE_URL is not set)");
  }

  console.log(`model: ${artifact.modelVersion}`);
  console.log(`rows: ${artifact.training.n} events: ${artifact.training.events}`);
  console.log(
    `brier: ${number(artifact.metrics.brier, 4)} (engine ${number(artifact.metrics.baselineBrier, 4)})`,
  );
  console.log(`ece: ${number(artifact.metrics.ece, 4)} auroc: ${number(artifact.metrics.auroc, 4)}`);
  console.log(`wrote: ${output}`);
  console.log(`card: ${card}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
