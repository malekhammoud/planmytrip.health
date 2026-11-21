/**
 * Generates a deterministic synthetic cohort for the calibration pipeline.
 *
 * Inputs: --trips, --seed, --out (JSONL), and optional DATABASE_URL for a Postgres seed.
 * Outputs: labeled training rows and, when configured, consented dossiers and outcomes in
 * PostgreSQL.
 * Invariants: every dose is computed from blocks; labels come from a known logistic
 * dose-response with condition effects and noise; the same seed produces the same rows.
 * The cohort is synthetic and must never be described as clinical evidence.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
  AgentTripPlan,
  PlannerDay,
  PlannerDayBlock,
  PlannerPlace,
  PlanBlockKind,
  BudgetLevel,
} from "../lib/agent/agentTypes";
import { CONDITION_PROFILES } from "../lib/conditionProfiles";
import { buildHealthTripPlan } from "../lib/healthTripEngine";
import type { Condition } from "../lib/types";
import { CONDITIONS } from "../lib/types";
import {
  adherenceMultiplier,
  computePlannerDose,
  computeTripFeatures,
} from "../lib/data/dose";
import { buildTripDossier } from "../lib/data/tripDossier";
import type {
  AdherenceLevel,
  AgentResultSummary,
  CareLevel,
  FlareSeverity,
  OutcomeRecord,
  TrainingRow,
  WorkerFindingSummary,
} from "../lib/data/types";
import { engineOffset } from "../lib/model/features";
import { closeDatabase } from "../lib/db/postgres";
import { saveDossier, saveOutcome } from "../lib/db/trips";

const DESTINATIONS = [
  "Lisbon, Portugal",
  "Kyoto, Japan",
  "Reykjavik, Iceland",
  "San Miguel de Allende, Mexico",
  "Ljubljana, Slovenia",
  "Bologna, Italy",
  "Busan, South Korea",
  "Valencia, Spain",
];

const BUDGETS: readonly BudgetLevel[] = ["value", "balanced", "premium"];
const ADHERENCE: readonly AdherenceLevel[] = ["less", "same", "more"];
const SEVERITIES: readonly FlareSeverity[] = ["mild", "moderate", "severe"];
const CARE: readonly CareLevel[] = ["none", "none", "clinic", "er", "hospital"];

const CONDITION_EFFECT: Readonly<Record<Condition, number>> = {
  asthma_respiratory: 0,
  chronic_fatigue_pots: 0.4,
  pregnancy_second_trimester: -0.2,
  severe_food_allergy: 0.25,
  cardiac_hypertension: 0.35,
};

const BASE_TIME = Date.parse("2026-01-01T00:00:00.000Z");

interface Options {
  trips: number;
  seed: number;
  out: string;
}

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function integerOption(name: string, fallback: number): number {
  const value = Number.parseInt(option(name, String(fallback)), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(random: () => number): number {
  const u = Math.max(random(), 1e-9);
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function pick<T>(random: () => number, values: readonly T[]): T {
  return values[Math.floor(random() * values.length)];
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

let placeSequence = 0;

function makePlace(input: {
  name: string;
  category: PlannerPlace["category"];
  area: string;
  durationMin: number | null;
  day: number;
  distanceKm?: number | null;
  elevationM?: number | null;
  difficulty?: string | null;
}): PlannerPlace {
  placeSequence += 1;
  return {
    id: `place-${placeSequence}`,
    name: input.name,
    category: input.category,
    area: input.area,
    lat: null,
    lng: null,
    why: "Synthetic placeholder.",
    notes: null,
    priceBand: null,
    durationMin: input.durationMin,
    nights: input.category === "stay" ? 2 : null,
    distanceKm: input.distanceKm ?? null,
    elevationM: input.elevationM ?? null,
    difficulty: input.difficulty ?? null,
    booking: null,
    sourceUrl: null,
    address: null,
    phone: null,
    careType: null,
    day: input.day,
  };
}

function block(
  kind: PlanBlockKind,
  title: string,
  durationMin: number,
  placeId: string | null,
): PlannerDayBlock {
  return { time: "10:00", kind, title, detail: "", durationMin, placeId };
}

interface GeneratedTrip {
  dossier: ReturnType<typeof buildTripDossier>;
  outcome: OutcomeRecord;
  row: TrainingRow;
}

function buildTrip(
  index: number,
  random: () => number,
): GeneratedTrip {
  const condition = pick(random, CONDITIONS);
  const days = 2 + Math.floor(random() * 6);
  const destination = pick(random, DESTINATIONS);
  const budget = pick(random, BUDGETS);
  const profile = CONDITION_PROFILES[condition];
  const enginePlan = buildHealthTripPlan({
    destination,
    days,
    condition,
    medication: "synthetic medication",
    hasSunLifeTravelCoverage: random() < 0.5,
  });

  const places: PlannerPlace[] = [];
  const planDays: PlannerDay[] = [];

  for (let dayNumber = 1; dayNumber <= days; dayNumber += 1) {
    const engineDay = enginePlan.itinerary[dayNumber - 1];
    const blocks: PlannerDayBlock[] = [];
    const area = `District ${1 + (dayNumber % 4)}`;

    if (dayNumber === 1) {
      const stay = makePlace({
        name: `Synthetic stay ${index}-${dayNumber}`,
        category: "stay",
        area,
        durationMin: 45,
        day: dayNumber,
      });
      places.push(stay);
      blocks.push(block("stay", stay.name, 45, stay.id));
    }

    const isHike = random() < 0.34;
    if (isHike) {
      const distanceKm = round(2 + random() * 5, 1);
      const elevationM = Math.round(30 + random() * 240);
      const difficulty =
        elevationM > 220 || distanceKm > 6 ? "moderate" : "easy";
      const durationMin = Math.round(30 + random() * 60);
      const hike = makePlace({
        name: `Synthetic trail ${index}-${dayNumber}`,
        category: "hike",
        area,
        durationMin,
        day: dayNumber,
        distanceKm,
        elevationM,
        difficulty,
      });
      places.push(hike);
      blocks.push(block("hike", hike.name, durationMin, hike.id));
    } else {
      const durationMin = Math.round(30 + random() * 45);
      const visit = makePlace({
        name: `Synthetic visit ${index}-${dayNumber}`,
        category: "visit",
        area,
        durationMin,
        day: dayNumber,
      });
      places.push(visit);
      blocks.push(block("visit", visit.name, durationMin, visit.id));
    }

    if (random() < 0.4) {
      blocks.push(block("transit", "Local transit", 10 + Math.round(random() * 15), null));
    }

    const meal = makePlace({
      name: `Synthetic table ${index}-${dayNumber}`,
      category: "eat",
      area,
      durationMin: 45,
      day: dayNumber,
    });
    places.push(meal);
    blocks.push(block("meal", meal.name, 30 + Math.round(random() * 15), meal.id));

    const recovery = Math.max(
      20,
      Math.round(profile.recoveryMinutes * (0.6 + random() * 0.4)),
    );
    blocks.push(block("rest", "Recovery window", recovery, null));

    if (random() < 0.25) {
      const second = makePlace({
        name: `Synthetic stop ${index}-${dayNumber}`,
        category: "visit",
        area,
        durationMin: 30,
        day: dayNumber,
      });
      places.push(second);
      blocks.push(block("visit", second.name, 20 + Math.round(random() * 15), second.id));
    }

    planDays.push({
      day: dayNumber,
      title: `Synthetic day ${dayNumber}`,
      area,
      restDay: false,
      stepEstimate: 0,
      walkingKm: 0,
      recoveryMinutes: recovery,
      blocks,
      stepCeiling: engineDay.stepCap,
      walkingCapKm: engineDay.walkingCapKm,
      withinCaps: true,
      checkpoint: engineDay.healthCheckpoint,
    });
  }

  const computedDose = computePlannerDose(planDays, places, "concierge");
  for (const [position, day] of planDays.entries()) {
    const dose = computedDose[position];
    // Deliberately noisy self-report: the pipeline must use the computed dose.
    day.stepEstimate = Math.round(dose.steps * (0.55 + random() * 0.7));
    day.walkingKm = round(dose.walkingKm * (0.55 + random() * 0.7), 1);
    day.withinCaps =
      dose.steps <= day.stepCeiling && dose.walkingKm <= day.walkingCapKm;
  }

  const adherenceLevel = pick(random, ADHERENCE);
  const features = computeTripFeatures({
    dose: computedDose,
    profile,
    days,
    places,
    adherence: adherenceMultiplier(adherenceLevel),
  });

  const offset = engineOffset(enginePlan.healthSafetyScore);
  const linear =
    offset -
    0.5 +
    2.2 * (features.peakExposure - 0.45) -
    1.5 * (features.recoveryCoverage - 0.8) +
    0.2 * ((days - 4) / 1.5) +
    CONDITION_EFFECT[condition] +
    gaussian(random) * 0.2;
  const probability = Math.min(0.9, Math.max(0.01, 1 / (1 + Math.exp(-linear))));
  const label = random() < probability ? 1 : 0;

  const createdAt = new Date(BASE_TIME + index * 60_000).toISOString();
  const runId = `synthetic-${index.toString(36).padStart(6, "0")}`;
  const installId = `synthetic-user-${index % 120}`;
  const agentPlan: AgentTripPlan = {
    summary: "A synthetic paced plan.",
    baseArea: planDays[0]?.area ?? "",
    routeTheme: "Synthetic study route",
    days: planDays,
    places,
    safetyNotes: ["Synthetic cohort record."],
    bookingChecklist: [],
    budget: {
      level: budget,
      estimatedTotal: null,
      currency: "CAD",
      notes: "",
    },
    sources: [],
    generatedAt: createdAt,
    mock: true,
  };
  const research: AgentResultSummary[] = [
    { agentId: "stay", ok: true, summary: "Synthetic stay options." },
    { agentId: "trail", ok: true, summary: "Synthetic trail options." },
    { agentId: "care", ok: true, summary: "Synthetic care options." },
  ];
  const swarm: WorkerFindingSummary[] = [
    {
      worker: "advisory",
      ok: true,
      sourceUrl: null,
      retrievedAt: createdAt,
      summary: "Synthetic advisory.",
    },
  ];

  const dossier = buildTripDossier({
    runId,
    installId,
    createdAt,
    request: {
      destination,
      days,
      condition,
      medication: "synthetic medication",
      interests: "",
      budget,
      hasSunLifeTravelCoverage: false,
    },
    enginePlan,
    agentPlan,
    research,
    swarm,
  });

  const outcome: OutcomeRecord = {
    flare: label === 1,
    flareDay: label === 1 ? 1 + Math.floor(random() * days) : null,
    severity: label === 1 ? pick(random, SEVERITIES) : null,
    care: label === 1 ? pick(random, CARE) : null,
    adherence: adherenceLevel,
    notes: null,
    reportedAt: new Date(BASE_TIME + index * 60_000 + 30 * 86_400_000).toISOString(),
  };

  return {
    dossier,
    outcome,
    row: {
      runId,
      userId: installId,
      condition,
      features,
      offset,
      label: label === 1 ? 1 : 0,
      days,
    },
  };
}

async function main(): Promise<void> {
  const options: Options = {
    trips: integerOption("--trips", 900),
    seed: integerOption("--seed", 20261121),
    out: resolve(option("--out", "data/synthetic-trips.jsonl")),
  };
  const random = mulberry32(options.seed);
  const generated: GeneratedTrip[] = [];
  for (let index = 0; index < options.trips; index += 1) {
    generated.push(buildTrip(index, random));
  }

  mkdirSync(dirname(options.out), { recursive: true });
  writeFileSync(
    options.out,
    generated.map((trip) => JSON.stringify(trip.row)).join("\n") + "\n",
  );

  const events = generated.filter((trip) => trip.row.label === 1).length;
  console.log(`synthetic trips: ${generated.length}`);
  console.log(`events: ${events} (${((events / generated.length) * 100).toFixed(1)}%)`);
  console.log(`jsonl: ${options.out}`);

  if (process.env.DATABASE_URL?.trim()) {
    for (const trip of generated) {
      await saveDossier(trip.dossier);
      await saveOutcome(trip.dossier.runId, trip.dossier.installId, trip.outcome);
    }
    await closeDatabase();
    console.log("postgres: seeded");
  } else {
    console.log("postgres: skipped (DATABASE_URL is not set)");
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
