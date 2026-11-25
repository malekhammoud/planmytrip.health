import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { parseSaveTripBody, type SaveTripInput } from "../savedTrips";
import { closeDatabase, ensureSchema, resetDatabaseForTests } from "./postgres";
import {
  countSavedTrips,
  deleteSavedTrip,
  findSavedTripForRun,
  getSavedTrip,
  listSavedTrips,
  saveTrip,
} from "./savedTrips";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const TRIP = {
  destination: "Lisbon, Portugal",
  origin: "Toronto, Canada",
  days: 4,
  condition: "asthma_respiratory",
  interests: "",
  budget: "balanced",
  transport: "mixed",
  captureConsent: false,
};

const PLAN = {
  summary: "Four paced days in Lisbon.",
  baseArea: "Alfama",
  routeTheme: "Slow mornings",
  days: [
    {
      day: 1,
      title: "Arrival",
      area: "Alfama",
      restDay: false,
      stepEstimate: 2000,
      walkingKm: 1.2,
      recoveryMinutes: 30,
      blocks: [],
      stepCeiling: 3150,
      walkingCapKm: 2.5,
      withinCaps: true,
      checkpoint: "Stop if breathing changes.",
    },
  ],
  places: [],
  safetyNotes: [],
  bookingChecklist: [],
  budget: {
    level: "balanced",
    estimatedTotal: 1200,
    currency: "CAD",
    notes: "",
  },
  sources: [],
  generatedAt: "2026-11-21T10:00:00.000Z",
};

function input(
  destination = "Lisbon, Portugal",
  runId = "run-12345678",
): SaveTripInput {
  const parsed = parseSaveTripBody(
    {
      runId,
      trip: { ...TRIP, destination },
      plan: PLAN,
    },
    "2026-11-21T10:05:00.000Z",
  );
  if (parsed === null) throw new Error("test fixture was rejected");
  return parsed;
}

describeDb("saved trip storage", () => {
  beforeEach(async () => {
    await ensureSchema();
    await resetDatabaseForTests();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("saves, lists, reads, and deletes one account's trip", async () => {
    const saved = await saveTrip("user-1", input());
    const summaries = await listSavedTrips("user-1");
    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.destination).toBe("Lisbon, Portugal");
    expect(summaries[0]?.days).toBe(4);

    const trip = await getSavedTrip("user-1", saved.id);
    expect(trip?.plan.days).toHaveLength(1);
    expect(trip?.trip.origin).toBe("Toronto, Canada");

    expect(await deleteSavedTrip("user-1", saved.id)).toBe(true);
    expect(await getSavedTrip("user-1", saved.id)).toBeNull();
  });

  it("upserts the same run for one account instead of duplicating it", async () => {
    const first = await saveTrip("user-1", input("Lisbon, Portugal"));
    const second = await saveTrip("user-1", input("Porto, Portugal"));
    expect(second.id).toBe(first.id);
    expect(await listSavedTrips("user-1")).toHaveLength(1);
    expect((await getSavedTrip("user-1", first.id))?.trip.destination).toBe(
      "Porto, Portugal",
    );
  });

  it("never exposes one account's trip to another", async () => {
    const saved = await saveTrip("user-1", input());
    expect(await listSavedTrips("user-2")).toEqual([]);
    expect(await getSavedTrip("user-2", saved.id)).toBeNull();
    expect(await deleteSavedTrip("user-2", saved.id)).toBe(false);
    expect(await getSavedTrip("user-1", saved.id)).not.toBeNull();
  });

  it("counts rows and finds a run for the free-plan limit", async () => {
    expect(await countSavedTrips("user-1")).toBe(0);
    expect(await findSavedTripForRun("user-1", "run-12345678")).toBeNull();
    const saved = await saveTrip("user-1", input());
    expect(await countSavedTrips("user-1")).toBe(1);
    expect(await countSavedTrips("user-2")).toBe(0);
    expect(await findSavedTripForRun("user-1", "run-12345678")).toBe(saved.id);
    expect(await findSavedTripForRun("user-2", "run-12345678")).toBeNull();
  });
});
