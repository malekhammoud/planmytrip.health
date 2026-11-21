/**
 * Persistence for trip dossiers, outcomes, and model runs.
 *
 * Inputs: a consented TripDossier, bounded swarm findings, an outcome, or a trained
 * artifact. Outputs: SQLite rows, safe trip summaries, and TrainingRow[] for offline
 * training. Invariants: writes are keyed by run_id and scoped by install_id; an outcome
 * write only succeeds for the install that owns the run; exported rows always carry an
 * explicit label.
 */

import type { Condition } from "../types";
import { isCondition } from "../types";
import {
  adherenceMultiplier,
} from "../data/dose";
import type {
  OutcomeRecord,
  PlannedDose,
  TrainingRow,
  TripDossier,
  TripFeatures,
  TripRequestRecord,
  WorkerFindingSummary,
} from "../data/types";
import { engineOffset } from "../model/features";
import type { ModelArtifact } from "../model/types";
import { getDatabase } from "./sqlite";

interface CaptureRow {
  run_id: string;
  install_id: string;
  created_at: string;
  request_json: string;
  engine_json: string;
  plan_json: string | null;
  dose_json: string;
  features_json: string;
  swarm_json: string;
  outcome_json: string | null;
  label_flare: number | null;
  label_severity: string | null;
  label_care: string | null;
  label_flare_day: number | null;
  outcome_at: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(value: string | null): unknown {
  if (value === null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function asDoseList(value: unknown): PlannedDose[] {
  return Array.isArray(value) ? (value as PlannedDose[]) : [];
}

function asRequest(value: unknown): TripRequestRecord | null {
  if (!isRecord(value)) return null;
  if (typeof value.destination !== "string") return null;
  if (!isCondition(value.condition)) return null;
  return value as unknown as TripRequestRecord;
}

function asFeatures(value: unknown): TripFeatures | null {
  if (!isRecord(value)) return null;
  if (typeof value.peakExposure !== "number") return null;
  if (typeof value.recoveryCoverage !== "number") return null;
  if (typeof value.tripLength !== "number") return null;
  return value as unknown as TripFeatures;
}

function asScore(value: unknown): number | null {
  if (!isRecord(value)) return null;
  return typeof value.healthSafetyScore === "number"
    ? value.healthSafetyScore
    : null;
}

function toRow(value: unknown): CaptureRow | null {
  if (!isRecord(value)) return null;
  return value as unknown as CaptureRow;
}

/** Inserts or updates the planner half of a run. Outcome columns are preserved. */
export function saveDossier(dossier: TripDossier): void {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO trip_captures (
      run_id, install_id, schema_version, engine_version, created_at,
      consent_version, request_json, engine_json, plan_json, dose_json,
      features_json, research_json, swarm_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(run_id) DO UPDATE SET
      install_id = excluded.install_id,
      schema_version = excluded.schema_version,
      engine_version = excluded.engine_version,
      created_at = excluded.created_at,
      consent_version = excluded.consent_version,
      request_json = excluded.request_json,
      engine_json = excluded.engine_json,
      plan_json = excluded.plan_json,
      dose_json = excluded.dose_json,
      features_json = excluded.features_json,
      research_json = excluded.research_json,
      swarm_json = excluded.swarm_json`,
  ).run(
    dossier.runId,
    dossier.installId,
    dossier.schemaVersion,
    "1",
    dossier.createdAt,
    dossier.consent.version,
    JSON.stringify(dossier.request),
    JSON.stringify(dossier.engine),
    JSON.stringify(dossier.plan),
    JSON.stringify(dossier.plan.days),
    JSON.stringify(dossier.features),
    JSON.stringify(dossier.verification.research),
    JSON.stringify(dossier.verification.swarm),
  );
}

/** Inserts a stub or updates the swarm half of a run that may finish first. */
export function saveSwarmFindings(
  runId: string,
  installId: string,
  findings: readonly WorkerFindingSummary[],
  createdAt: string,
): void {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO trip_captures (
      run_id, install_id, schema_version, engine_version, created_at,
      consent_version, request_json, engine_json, plan_json, dose_json,
      features_json, research_json, swarm_json
    ) VALUES (?, ?, 1, '1', ?, 1, '{}', '{}', NULL, '[]', '{}', '[]', ?)
    ON CONFLICT(run_id) DO UPDATE SET swarm_json = excluded.swarm_json`,
  ).run(runId, installId, createdAt, JSON.stringify(findings));
}

/**
 * Stores an outcome for the owning install and refreshes the adherence feature.
 * Returns false when the run is unknown or belongs to another install.
 */
export function saveOutcome(
  runId: string,
  installId: string,
  outcome: OutcomeRecord,
): boolean {
  const db = getDatabase();
  const row = toRow(
    db
      .prepare(
        "SELECT features_json FROM trip_captures WHERE run_id = ? AND install_id = ?",
      )
      .get(runId, installId),
  );
  if (row === null) return false;
  const features = asFeatures(parseJson(row.features_json));
  const adherence = adherenceMultiplier(outcome.adherence);
  const nextFeatures: TripFeatures | null =
    features === null
      ? null
      : { ...features, adherence: adherence ?? features.adherence };
  const result = db
    .prepare(
      `UPDATE trip_captures SET
        outcome_json = ?,
        label_flare = ?,
        label_severity = ?,
        label_care = ?,
        label_flare_day = ?,
        outcome_at = ?,
        features_json = ?
      WHERE run_id = ? AND install_id = ?`,
    )
    .run(
      JSON.stringify(outcome),
      outcome.flare ? 1 : 0,
      outcome.severity,
      outcome.care,
      outcome.flareDay,
      outcome.reportedAt,
      JSON.stringify(nextFeatures ?? features ?? {}),
      runId,
      installId,
    );
  return Number(result.changes) > 0;
}

/** One safe trip summary for the client; never includes another install's data. */
export interface TripSummary {
  runId: string;
  createdAt: string;
  destination: string;
  days: number;
  condition: Condition;
  flare: boolean | null;
  reportedAt: string | null;
}

/** Lists recent trips for one install. */
export function listTrips(installId: string, limit = 20): TripSummary[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT run_id, created_at, request_json, label_flare, outcome_at
       FROM trip_captures
       WHERE install_id = ? AND request_json <> '{}'
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(installId, limit)
    .map(toRow)
    .filter((row): row is CaptureRow => row !== null);
  return rows.flatMap((row) => {
    const request = asRequest(parseJson(row.request_json));
    if (request === null) return [];
    return [
      {
        runId: row.run_id,
        createdAt: row.created_at,
        destination: request.destination,
        days: request.days,
        condition: request.condition,
        flare: row.label_flare === null ? null : row.label_flare === 1,
        reportedAt: row.outcome_at,
      },
    ];
  });
}

/** Number of captured trips with and without outcomes. */
export function captureCounts(): { trips: number; outcomes: number } {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS trips,
        SUM(CASE WHEN label_flare IS NOT NULL THEN 1 ELSE 0 END) AS outcomes
       FROM trip_captures`,
    )
    .get();
  if (!isRecord(row)) return { trips: 0, outcomes: 0 };
  const trips = typeof row.trips === "number" ? row.trips : 0;
  const outcomes = typeof row.outcomes === "number" ? row.outcomes : 0;
  return { trips, outcomes };
}

/**
 * Exports labeled rows for offline training. A row without a label is skipped, never
 * treated as a negative.
 */
export function exportTrainingRows(): TrainingRow[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT run_id, install_id, request_json, engine_json, features_json,
        dose_json, label_flare
       FROM trip_captures
       WHERE label_flare IS NOT NULL`,
    )
    .all()
    .map(toRow)
    .filter((row): row is CaptureRow => row !== null);
  return rows.flatMap((row) => {
    const request = asRequest(parseJson(row.request_json));
    const features = asFeatures(parseJson(row.features_json));
    const score = asScore(parseJson(row.engine_json));
    if (request === null || features === null || score === null) return [];
    if (!isCondition(request.condition)) return [];
    return [
      {
        runId: row.run_id,
        userId: row.install_id,
        condition: request.condition,
        features,
        offset: engineOffset(score),
        label: row.label_flare === 1 ? 1 : 0,
        days: request.days,
      },
    ];
  });
}

/** Records a trained artifact for auditability. */
export function recordModelRun(artifact: ModelArtifact): void {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO model_runs (
      model_version, trained_at, schema_version, source, n, events,
      metrics_json, artifact_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(model_version) DO UPDATE SET
      trained_at = excluded.trained_at,
      n = excluded.n,
      events = excluded.events,
      metrics_json = excluded.metrics_json,
      artifact_json = excluded.artifact_json`,
  ).run(
    artifact.modelVersion,
    artifact.trainedAt,
    artifact.schemaVersion,
    artifact.source,
    artifact.training.n,
    artifact.training.events,
    JSON.stringify(artifact.metrics),
    JSON.stringify(artifact),
  );
}

/** One model run summary for the model page and diagnostics. */
export interface ModelRunSummary {
  modelVersion: string;
  trainedAt: string;
  source: string;
  n: number;
  events: number;
  metrics: unknown;
}

/** Lists recent model runs, newest first. */
export function listModelRuns(limit = 10): ModelRunSummary[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT model_version, trained_at, source, n, events, metrics_json
       FROM model_runs ORDER BY trained_at DESC LIMIT ?`,
    )
    .all(limit);
  return rows.flatMap((value) => {
    if (!isRecord(value)) return [];
    return [
      {
        modelVersion: String(value.model_version),
        trainedAt: String(value.trained_at),
        source: String(value.source),
        n: Number(value.n),
        events: Number(value.events),
        metrics: parseJson(
          typeof value.metrics_json === "string" ? value.metrics_json : null,
        ),
      },
    ];
  });
}

/** Reads one capture for tests and the outcome route. */
export function getCapture(runId: string): CaptureRow | null {
  const db = getDatabase();
  return toRow(
    db.prepare("SELECT * FROM trip_captures WHERE run_id = ?").get(runId),
  );
}

/** Reads the stored dose for one run; used by tests. */
export function getStoredDose(runId: string): PlannedDose[] {
  const row = getCapture(runId);
  if (row === null) return [];
  return asDoseList(parseJson(row.dose_json));
}
