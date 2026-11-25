import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MODEL_ARTIFACT } from "../model/artifact";
import type { TripDossier } from "../data/types";
import { closeDatabase, ensureSchema, getPool, resetDatabaseForTests } from "./postgres";
import {
  captureCounts,
  exportTrainingRows,
  getCapture,
  getStoredDose,
  listModelRuns,
  listTrips,
  recordModelRun,
  saveDossier,
  saveOutcome,
  saveSwarmFindings,
} from "./trips";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

function dossier(
  runId = "run-12345678",
  installId = "install-12345678",
  overrides: Partial<TripDossier> = {},
): TripDossier {
  return {
    schemaVersion: 1,
    runId,
    installId,
    createdAt: "2026-11-21T10:00:00.000Z",
    request: {
      destination: "Lisbon, Portugal",
      days: 4,
      condition: "asthma_respiratory",
      interests: "",
      budget: "balanced",
    },
    engine: {
      healthSafetyScore: 75,
      baselineScore: 50,
      riskReductionPct: 50,
      dailyStepCeiling: 7_000,
      dose: [],
    },
    plan: {
      source: "concierge",
      days: [
        {
          day: 1,
          steps: 2_000,
          walkingKm: 1,
          activeMinutes: 120,
          exertionWeightedMinutes: 180,
          recoveryMinutes: 30,
          stepCeiling: 3_150,
          walkingCapKm: 2.5,
          withinCaps: true,
          empty: false,
          source: "concierge",
        },
      ],
      degraded: false,
      mock: false,
    },
    verification: {
      research: [{ agentId: "culture", ok: true, summary: "Two visits." }],
      swarm: [],
    },
    features: {
      peakExposure: 0.6,
      recoveryCoverage: 0.8,
      tripLength: 4,
      adherence: null,
      heatFlag: 0,
      altitudeFlag: 0,
      baselineBurden: null,
    },
    consent: {
      capture: true,
      version: 1,
      at: "2026-11-21T10:00:00.000Z",
    },
    ...overrides,
  };
}

describeDb("trip capture storage", () => {
  beforeEach(async () => {
    await ensureSchema();
    await resetDatabaseForTests();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("saves a dossier, swarm findings, and an explicit outcome", async () => {
    await saveDossier(dossier());
    await saveSwarmFindings(
      "run-12345678",
      "install-12345678",
      [
        {
          worker: "advisory",
          ok: true,
          sourceUrl: "https://travel.gc.ca/travelling/advisories",
          retrievedAt: "2026-11-21T10:05:00.000Z",
          summary: "Exercise normal precautions.",
        },
      ],
      "2026-11-21T10:05:00.000Z",
    );
    expect(await getStoredDose("run-12345678")).toHaveLength(1);
    expect(
      await saveOutcome("run-12345678", "install-12345678", {
        flare: false,
        flareDay: null,
        severity: null,
        care: null,
        adherence: "same",
        notes: null,
        reportedAt: "2026-12-21T10:00:00.000Z",
      }),
    ).toBe(true);
    const row = await getCapture("run-12345678");
    expect(row?.label_flare).toBe(false);
    expect(row?.outcome_json).not.toBeNull();
  });

  it("keeps swarm findings when the planner dossier arrives later", async () => {
    await saveSwarmFindings(
      "run-12345678",
      "install-12345678",
      [
        {
          worker: "advisory",
          ok: true,
          sourceUrl: "https://travel.gc.ca/travelling/advisories",
          retrievedAt: "2026-11-21T10:05:00.000Z",
          summary: "Exercise normal precautions.",
        },
      ],
      "2026-11-21T10:05:00.000Z",
    );
    await saveDossier(dossier());
    const row = await getCapture("run-12345678");
    expect(Array.isArray(row?.swarm_json) ? row.swarm_json.length : 0).toBe(1);
    expect(await getStoredDose("run-12345678")).toHaveLength(1);
  });

  it("merges a one-worker retry without dropping its siblings", async () => {
    await saveDossier(dossier());
    const finding = (worker: string, summary: string) => ({
      worker,
      ok: true,
      sourceUrl: null,
      retrievedAt: "2026-11-21T10:05:00.000Z",
      summary,
    });
    await saveSwarmFindings(
      "run-12345678",
      "install-12345678",
      [
        finding("advisory", "Advisory first pass."),
        finding("pharmacy", "Pharmacy first pass."),
        finding("coverage", "Coverage first pass."),
      ],
      "2026-11-21T10:05:00.000Z",
    );
    await saveSwarmFindings(
      "run-12345678",
      "install-12345678",
      [finding("pharmacy", "Pharmacy retry.")],
      "2026-11-21T10:10:00.000Z",
    );
    const row = await getCapture("run-12345678");
    const findings = Array.isArray(row?.swarm_json)
      ? (row.swarm_json as Array<{ worker: string; summary: string }>)
      : [];
    expect(findings).toHaveLength(3);
    expect(findings.find((entry) => entry.worker === "pharmacy")?.summary).toBe(
      "Pharmacy retry.",
    );
    expect(findings.find((entry) => entry.worker === "advisory")?.summary).toBe(
      "Advisory first pass.",
    );
    expect(findings.find((entry) => entry.worker === "coverage")?.summary).toBe(
      "Coverage first pass.",
    );
  });

  it("keeps an outcome-derived adherence when the dossier is re-captured", async () => {
    await saveDossier(dossier());
    await saveOutcome("run-12345678", "install-12345678", {
      flare: false,
      flareDay: null,
      severity: null,
      care: null,
      adherence: "less",
      notes: null,
      reportedAt: "2026-12-21T10:00:00.000Z",
    });
    await saveDossier(dossier());
    const rows = await exportTrainingRows();
    const row = rows.find((entry) => entry.runId === "run-12345678");
    expect(row?.features.adherence).toBeCloseTo(0.75, 6);
  });

  it("refuses an outcome from another install", async () => {
    await saveDossier(dossier());
    expect(
      await saveOutcome("run-12345678", "other-install", {
        flare: true,
        flareDay: 2,
        severity: "mild",
        care: "none",
        adherence: "same",
        notes: null,
        reportedAt: "2026-12-21T10:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("refuses to persist a dossier without capture consent", async () => {
    const noConsent = dossier("run-no-consent", "install-12345678", {
      consent: {
        capture: true,
        version: 1,
        at: "2026-11-21T10:00:00.000Z",
      },
    });
    await saveDossier({
      ...noConsent,
      consent: { ...noConsent.consent, capture: false as unknown as true },
    });
    expect(await getCapture("run-no-consent")).toBeNull();
  });

  it("exports only labeled rows", async () => {
    await saveDossier(dossier());
    await saveOutcome("run-12345678", "install-12345678", {
      flare: false,
      flareDay: null,
      severity: null,
      care: null,
      adherence: "same",
      notes: null,
      reportedAt: "2026-12-21T10:00:00.000Z",
    });
    const rows = await exportTrainingRows();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const row = rows.find((entry) => entry.runId === "run-12345678");
    expect(row?.label).toBe(0);
    expect(row?.condition).toBe("asthma_respiratory");
    expect(Number.isFinite(row?.offset)).toBe(true);
  });

  it("lists trips and counts outcomes for one install", async () => {
    await saveDossier(dossier());
    await saveOutcome("run-12345678", "install-12345678", {
      flare: false,
      flareDay: null,
      severity: null,
      care: null,
      adherence: "same",
      notes: null,
      reportedAt: "2026-12-21T10:00:00.000Z",
    });
    const trips = await listTrips("install-12345678");
    expect(trips.some((trip) => trip.runId === "run-12345678")).toBe(true);
    const counts = await captureCounts();
    expect(counts.trips).toBeGreaterThanOrEqual(1);
    expect(counts.outcomes).toBeGreaterThanOrEqual(1);
  });

  it("records a model run for audit", async () => {
    await recordModelRun(MODEL_ARTIFACT);
    const runs = await listModelRuns();
    expect(
      runs.some((run) => run.modelVersion === MODEL_ARTIFACT.modelVersion),
    ).toBe(true);
  });

  it("never exports a mock plan as an observed training row", async () => {
    const mock = dossier("run-mock-1234", "install-12345678", {
      plan: {
        source: "concierge",
        days: [],
        degraded: false,
        mock: true,
      },
    });
    await saveDossier(mock);
    await saveOutcome("run-mock-1234", "install-12345678", {
      flare: true,
      flareDay: 2,
      severity: "mild",
      care: "none",
      adherence: "same",
      notes: null,
      reportedAt: "2026-12-21T10:00:00.000Z",
    });
    const rows = await exportTrainingRows();
    expect(rows.some((row) => row.runId === "run-mock-1234")).toBe(false);
  });

  it("never exports a row written under another data schema", async () => {
    const stale = dossier("run-stale-1234", "install-12345678", {
      schemaVersion: 1,
    });
    // Simulate a pre-migration row. The type is a literal, so cast through unknown.
    await saveDossier({ ...stale, schemaVersion: 0 } as unknown as TripDossier);
    await saveOutcome("run-stale-1234", "install-12345678", {
      flare: false,
      flareDay: null,
      severity: null,
      care: null,
      adherence: "same",
      notes: null,
      reportedAt: "2026-12-21T10:00:00.000Z",
    });
    const rows = await exportTrainingRows();
    expect(rows.some((row) => row.runId === "run-stale-1234")).toBe(false);
  });

  it("never mixes an offset from another engine version into training", async () => {
    await saveDossier(dossier("run-engine-1234"));
    await saveOutcome("run-engine-1234", "install-12345678", {
      flare: false,
      flareDay: null,
      severity: null,
      care: null,
      adherence: "same",
      notes: null,
      reportedAt: "2026-12-21T10:00:00.000Z",
    });
    await getPool().query(
      "UPDATE trip_captures SET engine_version = '0' WHERE run_id = $1",
      ["run-engine-1234"],
    );
    const rows = await exportTrainingRows();
    expect(rows.some((row) => row.runId === "run-engine-1234")).toBe(false);
  });

  it("does not let another install overwrite a dossier or its findings", async () => {
    await saveDossier(dossier());
    await saveDossier(
      dossier("run-12345678", "other-install-1234", {
        request: {
          destination: "Kyoto, Japan",
          days: 2,
          condition: "cardiac_hypertension",
          interests: "",
          budget: "value",
        },
      }),
    );
    const row = await getCapture("run-12345678");
    expect(row?.install_id).toBe("install-12345678");
    const request = row?.request_json as { destination?: string } | undefined;
    expect(request?.destination).toBe("Lisbon, Portugal");

    await saveSwarmFindings(
      "run-12345678",
      "other-install-1234",
      [
        {
          worker: "advisory",
          ok: true,
          sourceUrl: null,
          retrievedAt: "2026-11-21T10:05:00.000Z",
          summary: "Should not land.",
        },
      ],
      "2026-11-21T10:05:00.000Z",
    );
    const after = await getCapture("run-12345678");
    expect(after?.swarm_json).toEqual([]);
  });

  it("clamps list limits without throwing", async () => {
    await saveDossier(dossier());
    await expect(listTrips("install-12345678", Number.NaN)).resolves.toBeDefined();
    await expect(listModelRuns(0)).resolves.toBeDefined();
    await expect(listModelRuns(10_000)).resolves.toBeDefined();
  });
});
