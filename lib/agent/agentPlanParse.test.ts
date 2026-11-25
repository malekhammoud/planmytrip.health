import { describe, expect, it } from "vitest";
import { normalizeSpecialistResult, type SpecialistResult } from "./agentParse";
import { buildConciergePlan, normalizeWirePlan } from "./agentPlanParse";
import type {
  PlannerCapInput,
  PlannerRequest,
  SpecialistAgentId,
} from "./agentTypes";

const request: PlannerRequest = {
  destination: "Lisbon, Portugal",
  origin: "",
  transport: "mixed",
  checkIn: "",
  travelers: 1,
  days: 4,
  condition: "asthma_respiratory",
  interests: "quiet food",
  budget: "balanced",
};

const caps: PlannerCapInput[] = [
  { day: 1, stepCap: 3150, walkingCapKm: 1.8, checkpoint: "Checkpoint one" },
  { day: 2, stepCap: 5600, walkingCapKm: 3.2, checkpoint: "Checkpoint two" },
  { day: 3, stepCap: 5600, walkingCapKm: 3.2, checkpoint: "Checkpoint three" },
  { day: 4, stepCap: 2800, walkingCapKm: 1.6, checkpoint: "Checkpoint four" },
];

function research(): Partial<Record<SpecialistAgentId, SpecialistResult>> {
  return {
    stay: normalizeSpecialistResult("stay", {
      stays: [
        {
          name: "Hotel A",
          area: "Old town",
          lat: 38.71,
          lng: -9.14,
          why: "Central base.",
          sourceUrl: "https://example.com/hotel-a",
        },
      ],
    }),
    table: normalizeSpecialistResult("table", {
      restaurants: [
        {
          name: "Cafe B",
          area: "Old town",
          lat: 38.72,
          lng: -9.13,
          why: "Quiet lunch.",
          sourceUrl: "https://example.com/cafe-b",
        },
      ],
    }),
    trail: normalizeSpecialistResult("trail", {
      hikes: [
        {
          name: "Garden loop",
          area: "Garden district",
          lat: 38.73,
          lng: -9.15,
          distanceKm: 2.2,
          why: "Gentle loop.",
          sourceUrl: "https://example.com/garden",
        },
      ],
    }),
    culture: normalizeSpecialistResult("culture", {
      visits: [
        {
          name: "Museum C",
          area: "Museum quarter",
          lat: 38.7,
          lng: -9.16,
          why: "Seated galleries.",
          sourceUrl: "https://example.com/museum",
        },
      ],
    }),
    care: normalizeSpecialistResult("care", {
      hospitals: [
        {
          name: "Central Hospital",
          address: "1 Main Street",
          lat: 38.74,
          lng: -9.17,
          sourceUrl: "https://example.com/hospital",
        },
      ],
      emergencyNumber: "112",
      sources: [{ title: "Care page", url: "https://example.com/care" }],
    }),
  };
}

const raw = {
  summary: "A quiet four-day plan.",
  baseArea: "Old town",
  routeTheme: "One anchor a day",
  days: [
    {
      day: 1,
      title: "Arrival",
      area: "Old town",
      restDay: false,
      stepEstimate: 2000,
      walkingKm: 1.2,
      recoveryMinutes: 30,
      blocks: [
        {
          time: "15:00",
          kind: "stay",
          title: "Check in",
          detail: "Unpack.",
          durationMin: 45,
          placeName: "Hotel A",
        },
      ],
    },
    {
      day: 2,
      title: "Garden day",
      area: "Garden district",
      restDay: false,
      stepEstimate: 9000,
      walkingKm: 5,
      recoveryMinutes: 30,
      blocks: [
        {
          time: "10:00",
          kind: "hike",
          title: "Garden loop",
          detail: "Gentle loop.",
          durationMin: 90,
          placeName: "Garden loop",
        },
      ],
    },
    {
      day: 3,
      title: "Rest",
      area: "Old town",
      restDay: true,
      stepEstimate: 1200,
      walkingKm: 0.6,
      recoveryMinutes: 60,
      blocks: [],
    },
    {
      day: 4,
      title: "Museum and return",
      area: "Museum quarter",
      restDay: false,
      stepEstimate: 2000,
      walkingKm: 1.1,
      recoveryMinutes: 30,
      blocks: [
        {
          time: "10:00",
          kind: "visit",
          title: "Museum C",
          detail: "Seated galleries.",
          durationMin: 60,
          placeName: "Museum C",
        },
        {
          time: "13:00",
          kind: "meal",
          title: "Cafe B",
          detail: "Quiet lunch.",
          durationMin: 60,
          placeName: "Cafe B",
        },
      ],
    },
  ],
  selectedStays: ["Hotel A", "Unknown Hotel"],
  selectedDining: ["Cafe B"],
  selectedHikes: ["Garden loop"],
  selectedVisits: ["Museum C"],
  selectedCare: ["Central Hospital"],
  safetyNotes: ["Carry water."],
  bookingChecklist: ["Confirm the museum hours."],
  budget: {
    level: "balanced",
    estimatedTotal: 2400,
    currency: "CAD",
    notes: "Excludes flights.",
  },
};

describe("buildConciergePlan", () => {
  it("builds a capped day plan from known research picks", () => {
    const plan = buildConciergePlan(raw, request, research(), caps, "2026-11-21T10:00:00.000Z");
    expect(plan.days).toHaveLength(4);
    expect(plan.places.map((place) => place.name)).toEqual([
      "Hotel A",
      "Cafe B",
      "Garden loop",
      "Museum C",
      "Central Hospital",
    ]);
    expect(plan.places.find((place) => place.name === "Hotel A")?.day).toBe(1);
    expect(plan.places.find((place) => place.name === "Museum C")?.day).toBe(4);
    expect(plan.days[1]).toMatchObject({
      stepCeiling: 5600,
      walkingCapKm: 3.2,
      withinCaps: false,
      checkpoint: "Checkpoint two",
    });
    expect(plan.safetyNotes).toContain(
      "At least one day exceeds its modeled safety ceiling. Follow the Pacing limits.",
    );
    expect(plan.budget).toEqual({
      level: "balanced",
      estimatedTotal: 2400,
      currency: "CAD",
      notes: "Excludes flights.",
    });
    expect(plan.sources.some((source) => source.url === "https://example.com/care")).toBe(
      true,
    );
    expect(plan.generatedAt).toBe("2026-11-21T10:00:00.000Z");
  });

  it("matches caps by day number when the array is out of order", () => {
    const outOfOrder = buildConciergePlan(
      { ...raw, days: [raw.days[2], raw.days[0]] },
      request,
      research(),
      caps,
      "2026-11-21T10:00:00.000Z",
    );
    expect(outOfOrder.days[0]?.day).toBe(1);
    expect(outOfOrder.days[0]?.stepCeiling).toBe(3150);
    expect(outOfOrder.days[1]?.day).toBe(3);
    expect(outOfOrder.days[1]?.stepCeiling).toBe(5600);
  });

  it("pads missing days and ignores unknown selected names", () => {
    const plan = buildConciergePlan(
      { ...raw, days: raw.days.slice(0, 1), selectedStays: ["Unknown Hotel"] },
      request,
      research(),
      caps,
      "2026-11-21T10:00:00.000Z",
    );
    expect(plan.days).toHaveLength(4);
    expect(plan.days[2]?.stepCeiling).toBe(5600);
    expect(plan.places.some((place) => place.name === "Unknown Hotel")).toBe(false);
  });

  it("falls back to the request budget for a malformed budget", () => {
    const plan = buildConciergePlan(
      { ...raw, budget: { level: "luxury" } },
      request,
      research(),
      caps,
      "2026-11-21T10:00:00.000Z",
    );
    expect(plan.budget.level).toBe("balanced");
  });

  it("catches an over-cap block even when the agent estimate is zero", () => {
    const understated = {
      ...raw,
      days: [
        raw.days[0],
        {
          ...raw.days[1],
          stepEstimate: 0,
          walkingKm: 0,
          blocks: [
            {
              time: "09:00",
              kind: "hike",
              title: "Long ridge",
              detail: "",
              durationMin: 300,
              placeName: "Garden loop",
            },
          ],
        },
        raw.days[2],
        raw.days[3],
      ],
    };
    const plan = buildConciergePlan(
      understated,
      request,
      research(),
      caps,
      "2026-11-21T10:00:00.000Z",
    );
    // 300 min at exertion 2 -> 7,800 modeled steps, above the 5,600 cap.
    expect(plan.days[1]?.stepEstimate).toBe(0);
    expect(plan.days[1]?.withinCaps).toBe(false);
    expect(plan.safetyNotes).toContain(
      "At least one day exceeds its modeled safety ceiling. Follow the Pacing limits.",
    );
  });
});

describe("normalizeWirePlan", () => {
  it("rebuilds a plan and drops malformed places", () => {
    const plan = buildConciergePlan(raw, request, research(), caps, "2026-11-21T10:00:00.000Z");
    const wire = normalizeWirePlan(JSON.parse(JSON.stringify(plan)));
    expect(wire).not.toBeNull();
    expect(wire?.days).toHaveLength(4);
    expect(wire?.places).toHaveLength(5);
    expect(wire?.places[0]?.sourceUrl).toBe("https://example.com/hotel-a");
  });

  it("keeps all 20 supported days", () => {
    const longCaps: PlannerCapInput[] = Array.from({ length: 20 }, (_, index) => ({
      day: index + 1,
      stepCap: 3150,
      walkingCapKm: 1.8,
      checkpoint: "Checkpoint",
    }));
    const plan = buildConciergePlan(
      raw,
      { ...request, days: 20 },
      research(),
      longCaps,
      "2026-11-21T10:00:00.000Z",
    );
    const wire = normalizeWirePlan(JSON.parse(JSON.stringify(plan)));
    expect(wire?.days).toHaveLength(20);
  });

  it("keeps block place ids across the wire so the map and day links survive", () => {
    const plan = buildConciergePlan(raw, request, research(), caps, "2026-11-21T10:00:00.000Z");
    const wire = normalizeWirePlan(JSON.parse(JSON.stringify(plan)));
    expect(wire?.days[0]?.blocks[0]?.placeId).toBe("place-1");
    expect(wire?.days[1]?.blocks[0]?.placeId).toBe("place-3");
  });

  it("recomputes the cap flag from the wire blocks", () => {
    const plan = buildConciergePlan(raw, request, research(), caps, "2026-11-21T10:00:00.000Z");
    const payload = JSON.parse(JSON.stringify(plan)) as Record<string, unknown> & {
      days: Array<Record<string, unknown>>;
    };
    const second = payload.days[1];
    second.stepEstimate = 0;
    second.walkingKm = 0;
    second.blocks = [
      {
        time: "09:00",
        kind: "hike",
        title: "Long ridge",
        detail: "",
        durationMin: 300,
        placeId: "place-3",
      },
    ];
    const wire = normalizeWirePlan(payload);
    expect(wire?.days[1]?.withinCaps).toBe(false);

  });

  it("rejects a payload without a summary or days", () => {
    expect(normalizeWirePlan({})).toBeNull();
    expect(normalizeWirePlan({ summary: "x", days: [] })).toBeNull();
  });
});
