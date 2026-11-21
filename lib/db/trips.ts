/**
 * PostgreSQL persistence for trip dossiers, outcomes, and model runs.
 *
 * Inputs: a consented TripDossier, bounded swarm findings, an outcome, or a trained
 * artifact. Outputs: rows, safe trip summaries, and TrainingRow[] for offline training.
 * Invariants: writes are keyed by run_id and scoped by install_id; an outcome write only
 * succeeds for the install that owns the run; exported rows always carry an explicit label;
 * every JSON column is JSONB and every query is parameterized.
 */

import type { Condition } from "../types";
import { isCondition } from "../types";
import { adherenceMultiplier } from "../data/dose";
import { DATA_SCHEMA_VERSION, ENGINE_VERSION } from "../data/types";
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
import { ensureSchema, getPool } from "./postgres";

interface CaptureRow {
  run_id: string;
  install_id: string;
  created_at: string;
  request_json: unknown;
  engine_json: unknown;
  plan_json: unknown;
  dose_json: unknown;
  features_json: unknown;
  swarm_json: unknown;
  outcome_json: unknown;
  label_flare: boolean | null;
  label_severity: string | null;
  label_care: string | null;
  label_flare_day: number | null;
  outcome_at: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function asIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : null;
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

/** Keeps a caller-supplied limit finite and inside the public API's small-page range. */
function boundedLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 20;
  return Math.max(1, Math.min(100, Math.trunc(limit)));
}

function toRow(value: unknown): CaptureRow | null {
  if (!isRecord(value)) return null;
  const created = asIso(value.created_at);
  if (created === null) return null;
  return {
    run_id: String(value.run_id),
    install_id: String(value.install_id),
    created_at: created,
    request_json: value.request_json,
    engine_json: value.engine_json,
    plan_json: value.plan_json,
    dose_json: value.dose_json,
    features_json: value.features_json,
    swarm_json: value.swarm_json,
    outcome_json: value.outcome_json,
    label_flare:
      value.label_flare === null || value.label_flare === undefined
        ? null
        : value.label_flare === true,
    label_severity:
      typeof value.label_severity === "string" ? value.label_severity : null,
    label_care: typeof value.label_care === "string" ? value.label_care : null,
    label_flare_day:
      typeof value.label_flare_day === "number" ? value.label_flare_day : null,
    outcome_at: asIso(value.outcome_at),
  };
}

/** Inserts or updates the planner half of a run. Outcome columns are preserved. */
export async function saveDossier(dossier: TripDossier): Promise<void> {
  // The type says consent is true, but storage is the last boundary: never persist a
  // dossier that was not explicitly consented to.
  if (dossier.consent.capture !== true) return;
  await ensureSchema();
  await getPool().query(
    `INSERT INTO trip_captures (
      run_id, install_id, schema_version, engine_version, created_at,
      consent_version, request_json, engine_json, plan_json, dose_json,
      features_json, research_json, swarm_json
    ) VALUES ($1, $2, $3, $4, $5::timestamptz, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (run_id) DO UPDATE SET
      install_id = EXCLUDED.install_id,
      schema_version = EXCLUDED.schema_version,
      engine_version = EXCLUDED.engine_version,
      created_at = EXCLUDED.created_at,
      consent_version = EXCLUDED.consent_version,
      request_json = EXCLUDED.request_json,
      engine_json = EXCLUDED.engine_json,
      plan_json = EXCLUDED.plan_json,
      dose_json = EXCLUDED.dose_json,
      features_json = CASE
        WHEN trip_captures.features_json->>'adherence' IS NOT NULL
          AND EXCLUDED.features_json->>'adherence' IS NULL
        THEN jsonb_set(
          EXCLUDED.features_json,
          '{adherence}',
          trip_captures.features_json->'adherence',
          true
        )
        ELSE EXCLUDED.features_json
      END,
      research_json = EXCLUDED.research_json,
      swarm_json = CASE
        WHEN trip_captures.swarm_json = '[]'::jsonb THEN EXCLUDED.swarm_json
        ELSE trip_captures.swarm_json
      END
    WHERE trip_captures.install_id = EXCLUDED.install_id`,
    [
      dossier.runId,
      dossier.installId,
      dossier.schemaVersion,
      ENGINE_VERSION,
      dossier.createdAt,
      dossier.consent.version,
      JSON.stringify(dossier.request),
      JSON.stringify(dossier.engine),
      JSON.stringify(dossier.plan),
      JSON.stringify(dossier.plan.days),
      JSON.stringify(dossier.features),
      JSON.stringify(dossier.verification.research),
      JSON.stringify(dossier.verification.swarm),
    ],
  );
}

/** Inserts a stub or updates the swarm half of a run that may finish first. */
export async function saveSwarmFindings(
  runId: string,
  installId: string,
  findings: readonly WorkerFindingSummary[],
  createdAt: string,
): Promise<void> {
  await ensureSchema();
  await getPool().query(
    `INSERT INTO trip_captures (
      run_id, install_id, schema_version, engine_version, created_at,
      consent_version, request_json, engine_json, plan_json, dose_json,
      features_json, research_json, swarm_json
    ) VALUES ($1, $2, 1, $3, $4::timestamptz, 1, '{}'::jsonb, '{}'::jsonb, NULL,
      '[]'::jsonb, '{}'::jsonb, '[]'::jsonb, $5)
    ON CONFLICT (run_id) DO UPDATE SET swarm_json = (
      SELECT COALESCE(jsonb_agg(merged.value ORDER BY merged.worker), '[]'::jsonb)
      FROM (
        SELECT DISTINCT ON (candidate.value->>'worker')
          candidate.value,
          candidate.value->>'worker' AS worker
        FROM (
          SELECT entry.value, 0 AS priority
          FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(trip_captures.swarm_json) = 'array'
              THEN trip_captures.swarm_json ELSE '[]'::jsonb END
          ) AS entry
          UNION ALL
          SELECT entry.value, 1 AS priority
          FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(EXCLUDED.swarm_json) = 'array'
              THEN EXCLUDED.swarm_json ELSE '[]'::jsonb END
          ) AS entry
        ) AS candidate
        ORDER BY candidate.value->>'worker', candidate.priority DESC
      ) AS merged
    )
    WHERE trip_captures.install_id = EXCLUDED.install_id`,
    [runId, installId, ENGINE_VERSION, createdAt, JSON.stringify(findings)],
  );
}

/**
 * Stores an outcome for the owning install and refreshes the adherence feature.
 * Returns false when the run is unknown or belongs to another install.
 */
export async function saveOutcome(
  runId: string,
  installId: string,
  outcome: OutcomeRecord,
): Promise<boolean> {
  await ensureSchema();
  const db = getPool();
  const existing = await db.query(
    "SELECT features_json FROM trip_captures WHERE run_id = $1 AND install_id = $2",
    [runId, installId],
  );
  const first: unknown = existing.rows[0];
  if (!isRecord(first)) return false;
  const features = asFeatures(parseJson(first.features_json));
  const adherence = adherenceMultiplier(outcome.adherence);
  const nextFeatures: TripFeatures | null =
    features === null
      ? null
      : { ...features, adherence: adherence ?? features.adherence };
  const result = await db.query(
    `UPDATE trip_captures SET
      outcome_json = $1,
      label_flare = $2,
      label_severity = $3,
      label_care = $4,
      label_flare_day = $5,
      outcome_at = $6::timestamptz,
      features_json = $7
    WHERE run_id = $8 AND install_id = $9
    RETURNING run_id`,
    [
      JSON.stringify(outcome),
      outcome.flare,
      outcome.severity,
      outcome.care,
      outcome.flareDay,
      outcome.reportedAt,
      JSON.stringify(nextFeatures ?? features ?? {}),
      runId,
      installId,
    ],
  );
  return (result.rowCount ?? 0) > 0;
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
export async function listTrips(
  installId: string,
  limit = 20,
): Promise<TripSummary[]> {
  await ensureSchema();
  const result = await getPool().query(
    `SELECT run_id, created_at, request_json, label_flare, outcome_at
     FROM trip_captures
     WHERE install_id = $1 AND request_json <> '{}'::jsonb
     ORDER BY created_at DESC
     LIMIT $2`,
    [installId, boundedLimit(limit)],
  );
  return result.rows
    .map(toRow)
    .filter((row): row is CaptureRow => row !== null)
    .flatMap((row) => {
      const request = asRequest(parseJson(row.request_json));
      if (request === null) return [];
      return [
        {
          runId: row.run_id,
          createdAt: row.created_at,
          destination: request.destination,
          days: request.days,
          condition: request.condition,
          flare: row.label_flare,
          reportedAt: row.outcome_at,
        },
      ];
    });
}

/** Number of captured trips with and without outcomes. */
export async function captureCounts(): Promise<{
  trips: number;
  outcomes: number;
}> {
  await ensureSchema();
  const result = await getPool().query(
    `SELECT COUNT(*)::int AS trips,
      SUM(CASE WHEN label_flare IS NOT NULL THEN 1 ELSE 0 END)::int AS outcomes
     FROM trip_captures`,
  );
  const row: unknown = result.rows[0];
  if (!isRecord(row)) return { trips: 0, outcomes: 0 };
  return {
    trips: typeof row.trips === "number" ? row.trips : 0,
    outcomes: typeof row.outcomes === "number" ? row.outcomes : 0,
  };
}

/**
 * Exports labeled rows for offline training. A row without a label is skipped, never
 * treated as a negative. Mock plans are skipped too: they exist only for tests and
 * inspection and must never be able to masquerade as observed outcomes. Rows written
 * under another data schema or engine version are skipped until a migration maps them
 * explicitly, because their offsets mean something different.
 */
export async function exportTrainingRows(): Promise<TrainingRow[]> {
  await ensureSchema();
  const result = await getPool().query(
    `SELECT run_id, install_id, created_at, request_json, engine_json,
      features_json, dose_json, label_flare
     FROM trip_captures
     WHERE label_flare IS NOT NULL
       AND schema_version = $1
       AND engine_version = $2
       AND request_json <> '{}'::jsonb
       AND (plan_json IS NULL OR plan_json->>'mock' IS DISTINCT FROM 'true')`,
    [DATA_SCHEMA_VERSION, ENGINE_VERSION],
  );
  return result.rows
    .map(toRow)
    .filter((row): row is CaptureRow => row !== null)
    .flatMap((row) => {
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
          label: row.label_flare === true ? 1 : 0,
          days: request.days,
        },
      ];
    });
}

/** Records a trained artifact for auditability. */
export async function recordModelRun(artifact: ModelArtifact): Promise<void> {
  await ensureSchema();
  await getPool().query(
    `INSERT INTO model_runs (
      model_version, trained_at, schema_version, source, n, events,
      metrics_json, artifact_json
    ) VALUES ($1, $2::timestamptz, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (model_version) DO UPDATE SET
      trained_at = EXCLUDED.trained_at,
      n = EXCLUDED.n,
      events = EXCLUDED.events,
      metrics_json = EXCLUDED.metrics_json,
      artifact_json = EXCLUDED.artifact_json`,
    [
      artifact.modelVersion,
      artifact.trainedAt,
      artifact.schemaVersion,
      artifact.source,
      artifact.training.n,
      artifact.training.events,
      JSON.stringify(artifact.metrics),
      JSON.stringify(artifact),
    ],
  );
}

/** One model run summary for diagnostics. */
export interface ModelRunSummary {
  modelVersion: string;
  trainedAt: string;
  source: string;
  n: number;
  events: number;
  metrics: unknown;
}

/** Lists recent model runs, newest first. */
export async function listModelRuns(limit = 10): Promise<ModelRunSummary[]> {
  await ensureSchema();
  const result = await getPool().query(
    `SELECT model_version, trained_at, source, n, events, metrics_json
     FROM model_runs ORDER BY trained_at DESC LIMIT $1`,
    [boundedLimit(limit)],
  );
  return result.rows.flatMap((value: unknown) => {
    if (!isRecord(value)) return [];
    const trainedAt = asIso(value.trained_at);
    if (trainedAt === null) return [];
    return [
      {
        modelVersion: String(value.model_version),
        trainedAt,
        source: String(value.source),
        n: Number(value.n),
        events: Number(value.events),
        metrics: parseJson(value.metrics_json),
      },
    ];
  });
}

/** Reads one capture for tests and the outcome route. */
export async function getCapture(runId: string): Promise<CaptureRow | null> {
  await ensureSchema();
  const result = await getPool().query(
    "SELECT * FROM trip_captures WHERE run_id = $1",
    [runId],
  );
  return toRow(result.rows[0]);
}

/** Reads the stored dose for one run; used by tests. */
export async function getStoredDose(runId: string): Promise<PlannedDose[]> {
  const row = await getCapture(runId);
  if (row === null) return [];
  return asDoseList(parseJson(row.dose_json));
}
