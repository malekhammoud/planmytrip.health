/**
 * Reproducibility and documentation guard for the committed model artifact.
 *
 * The committed cohort, lib/model/model.json, and docs/MODEL_CARD.md must describe one
 * model. This test retrains from the committed JSONL with the shipped pipeline and
 * compares every learned value. A stale artifact, a silently edited card, or a change
 * to the training procedure without a retrain fails here.
 */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Condition } from "@/lib/types";
import { CONDITIONS, isCondition } from "@/lib/types";
import type { TrainingRow, TripFeatures } from "@/lib/data/types";
import { ENGINE_VERSION } from "@/lib/data/types";
import { MODEL_ARTIFACT, MODEL_AVAILABLE } from "@/lib/model/artifact";
import { predictFromArtifact, tierFor } from "@/lib/model/predict";
import { trainModel } from "@/lib/model/train";
import { V0_FEATURES } from "@/lib/model/types";

const root = resolve(process.cwd());
const cohortPath = resolve(root, "data/synthetic-trips.jsonl");
const cardPath = resolve(root, "docs/MODEL_CARD.md");

function loadCohort(): { raw: string; rows: TrainingRow[] } {
  const raw = readFileSync(cohortPath, "utf8");
  const rows = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const value = JSON.parse(line) as unknown;
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error("cohort row is not an object");
      }
      const record = value as Record<string, unknown>;
      if (typeof record.runId !== "string") throw new Error("bad runId");
      if (typeof record.userId !== "string") throw new Error("bad userId");
      if (!isCondition(record.condition)) throw new Error("bad condition");
      if (typeof record.offset !== "number") throw new Error("bad offset");
      if (record.label !== 0 && record.label !== 1) throw new Error("bad label");
      if (typeof record.days !== "number") throw new Error("bad days");
      const label: 0 | 1 = record.label === 1 ? 1 : 0;
      return {
        runId: record.runId,
        userId: record.userId,
        condition: record.condition,
        features: record.features as TripFeatures,
        offset: record.offset,
        label,
        days: record.days,
        ...(record.synthetic === true ? { synthetic: true as const } : {}),
      };
    });
  return { raw, rows };
}

describe("committed model artifact", () => {
  it("is available and is a synthetic, engine-safe artifact", () => {
    expect(MODEL_AVAILABLE).toBe(true);
    expect(MODEL_ARTIFACT.source).toBe("synthetic");
    expect(MODEL_ARTIFACT.training.n).toBeGreaterThan(0);
    for (const condition of CONDITIONS) {
      expect(tierFor(MODEL_ARTIFACT, condition)).toBe("synthetic");
    }
  });

  it("matches the committed cohort hash", () => {
    const { raw, rows } = loadCohort();
    const hash = createHash("sha256").update(raw).digest("hex");
    expect(MODEL_ARTIFACT.training.dataHash).toBe(hash);
    expect(MODEL_ARTIFACT.modelVersion).toBe(`synthetic-${hash.slice(0, 8)}`);
    // Every committed demo row carries the marker the training CLI rejects for an
    // outcomes artifact, so the demo cohort cannot silently become observed evidence.
    expect(rows.every((row) => row.synthetic === true)).toBe(true);
  });

  it("is reproducible from the committed JSONL with the shipped pipeline", () => {
    const { raw, rows } = loadCohort();
    const dataHash = createHash("sha256").update(raw).digest("hex");
    const retrained = trainModel(rows, {
      featureNames: [...V0_FEATURES],
      folds: 5,
      source: "synthetic",
      modelVersion: `synthetic-${dataHash.slice(0, 8)}`,
      trainedAt: "2026-01-01T00:00:00.000Z",
      engineVersion: ENGINE_VERSION,
      dataHash,
    });
    expect(retrained.featureStats).toEqual(MODEL_ARTIFACT.featureStats);
    expect(retrained.coefficients).toEqual(MODEL_ARTIFACT.coefficients);
    expect(retrained.covariance).toEqual(MODEL_ARTIFACT.covariance);
    expect(retrained.calibration).toEqual(MODEL_ARTIFACT.calibration);
    expect(retrained.training).toEqual(MODEL_ARTIFACT.training);
    expect(retrained.metrics).toEqual(MODEL_ARTIFACT.metrics);
  });

  it("keeps MODEL_CARD metrics and version in sync with the artifact", () => {
    const card = readFileSync(cardPath, "utf8");
    expect(card).toContain(`**Version:** \`${MODEL_ARTIFACT.modelVersion}\``);
    expect(card).toContain(`**Data hash:** \`${MODEL_ARTIFACT.training.dataHash}\``);
    expect(card).toContain(`**Pipeline version:** ${MODEL_ARTIFACT.pipelineVersion}`);
    expect(card).toContain(`| Brier score | ${MODEL_ARTIFACT.metrics.brier.toFixed(4)} |`);
    expect(card).toContain(
      `| Engine-only Brier | ${MODEL_ARTIFACT.metrics.baselineBrier.toFixed(4)} |`,
    );
    expect(card).toContain(
      `| Expected calibration error | ${MODEL_ARTIFACT.metrics.ece.toFixed(4)} |`,
    );
    expect(card).toContain(`| AUROC | ${MODEL_ARTIFACT.metrics.auroc.toFixed(4)} |`);
  });

  it("reports metrics that pass the documented ship gate", () => {
    const metrics = MODEL_ARTIFACT.metrics;
    expect(metrics.brier).toBeLessThan(metrics.baselineBrier);
    expect(metrics.ece).toBeLessThan(0.05);
    expect(metrics.auroc).toBeGreaterThan(0.5);
    expect(metrics.calibrationSlope).toBeGreaterThan(0.7);
    expect(metrics.calibrationSlope).toBeLessThan(1.3);
  });

  it("returns finite, bounded predictions for every condition", () => {
    const features: TripFeatures = {
      peakExposure: 0.7,
      recoveryCoverage: 0.6,
      tripLength: 4,
      adherence: null,
      heatFlag: 0,
      altitudeFlag: 0,
      baselineBurden: null,
    };
    for (const condition of CONDITIONS as readonly Condition[]) {
      const prediction = predictFromArtifact(
        MODEL_ARTIFACT,
        features,
        70,
        condition,
      );
      expect(prediction.tier).toBe("synthetic");
      expect(Number.isFinite(prediction.pFlare)).toBe(true);
      expect(prediction.pFlare).toBeGreaterThanOrEqual(0.005);
      expect(prediction.pFlare).toBeLessThanOrEqual(0.995);
      expect(prediction.interval[0]).toBeLessThanOrEqual(prediction.pFlare);
      expect(prediction.interval[1]).toBeGreaterThanOrEqual(prediction.pFlare);
    }
  });

  it("is never imported by a live API, capture, or planning module", () => {
    const roots = ["app/api", "lib/data", "lib/agent", "lib/db", "lib/engine"];
    const files: string[] = [];
    const walk = (relative: string): void => {
      for (const entry of readdirSync(resolve(root, relative), {
        withFileTypes: true,
      })) {
        const next = join(relative, entry.name);
        if (entry.isDirectory()) walk(next);
        else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
          files.push(next);
        }
      }
    };
    for (const directory of roots) {
      try {
        walk(directory);
      } catch {
        // A directory that does not exist in this layout is simply skipped.
      }
    }
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(resolve(root, file), "utf8");
      expect(source, file).not.toMatch(
        /from\s+["'][^"']*model\/(artifact|predict)["']/,
      );
    }
  });
});
