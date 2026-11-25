/**
 * Development-only mock concierge run for AGENT_MOCK=1.
 *
 * Inputs: a validated request, engine caps, an emit callback, and an abort signal.
 * Outputs: the same SSE event sequence as a live run, with `mock: true` on every frame.
 * Invariants: no network or OpenCode call; every mock place is clearly sample data;
 * the final plan passes the same normaliser as a live concierge result.
 */

import { CONDITION_PROFILES } from "@/lib/conditionProfiles";
import { buildConciergePlan } from "./agentPlanParse";
import type { DraftPlace, SpecialistResult } from "./agentParse";
import { normalizeSpecialistResult } from "./agentParse";
import {
  PLANNER_AGENTS,
  SPECIALIST_AGENT_IDS,
  type AgentTripPlan,
  type PlannerCapInput,
  type PlannerEvent,
  type PlannerRequest,
  type SpecialistAgentId,
} from "./agentTypes";

const BASE_COORDS: Readonly<Record<string, { lat: number; lng: number }>> = {
  "tokyo": { lat: 35.6762, lng: 139.6503 },
  "lisbon": { lat: 38.7223, lng: -9.1393 },
  "paris": { lat: 48.8566, lng: 2.3522 },
  "london": { lat: 51.5074, lng: -0.1278 },
  "new york": { lat: 40.7128, lng: -74.006 },
  "rome": { lat: 41.9028, lng: 12.4964 },
  "vancouver": { lat: 49.2827, lng: -123.1207 },
};

function baseFor(destination: string): { lat: number; lng: number } {
  const lower = destination.toLowerCase();
  for (const [key, value] of Object.entries(BASE_COORDS)) {
    if (lower.includes(key)) return value;
  }
  return { lat: 0, lng: 0 };
}

function offset(
  base: { lat: number; lng: number },
  index: number,
): { lat: number; lng: number } {
  const step = 0.008;
  const angle = (index * 137.5 * Math.PI) / 180;
  return {
    lat: Math.round((base.lat + Math.sin(angle) * step) * 1e5) / 1e5,
    lng: Math.round((base.lng + Math.cos(angle) * step) * 1e5) / 1e5,
  };
}

function now(): string {
  return new Date().toISOString();
}

function emitMock(emit: (event: PlannerEvent) => void, event: PlannerEvent): void {
  emit(event);
}

function mockRaw(agentId: SpecialistAgentId, request: PlannerRequest): unknown {
  const base = baseFor(request.destination);
  const place = (index: number) => offset(base, index);
  switch (agentId) {
    case "stay":
      return {
        stays: [
          ["Sample central hotel", "Old town", "Balanced", "Short walks to the first day's anchors."],
          ["Sample quiet hotel", "Garden district", "Value", "Quiet rooms and a short transfer from the station."],
          ["Sample premium hotel", "Riverside", "Premium", "A calm base with step-free access."],
        ].map(([name, area, priceBand, why], index) => ({
          name,
          area,
          priceBand,
          why,
          nights: request.days - 1,
          booking: "Book direct and confirm accessibility.",
          conditionNotes: "Confirm lift access and a quiet room.",
          lat: place(index).lat,
          lng: place(index).lng,
          sourceUrl: `https://mock.invalid/stay/${index + 1}`,
        })),
      };
    case "table":
      return {
        restaurants: [
          ["Sample breakfast room", "Old town", "Cafe", "breakfast"],
          ["Sample garden lunch", "Garden district", "Local", "lunch"],
          ["Sample quiet dinner", "Riverside", "Seasonal", "dinner"],
          ["Sample market counter", "Market hall", "Market", "lunch"],
        ].map(([name, area, cuisine, meal], index) => ({
          name,
          area,
          cuisine,
          meal,
          priceBand: index % 2 === 0 ? "Balanced" : "Value",
          why: "A short, low-exertion meal near the day's route.",
          dietaryNotes: "Ask about cross-contact and confirm ingredients.",
          reservation: "Reserve a table away from the door.",
          lat: place(index + 3).lat,
          lng: place(index + 3).lng,
          sourceUrl: `https://mock.invalid/table/${index + 1}`,
        })),
      };
    case "trail":
      return {
        hikes: [
          ["Sample garden loop", "Garden district", 2.4, 60, 90, "easy"],
          ["Sample river walk", "Riverside", 3.2, 80, 120, "easy"],
        ].map(([name, area, distanceKm, elevationM, durationMin, difficulty], index) => ({
          name,
          area,
          distanceKm,
          elevationM,
          durationMin,
          difficulty,
          terrain: "Flat paths with benches.",
          why: "A gentle route with frequent places to stop.",
          conditionNotes: "Turn back at the first unusual breathlessness.",
          recoveryDayAfter: true,
          lat: place(index + 7).lat,
          lng: place(index + 7).lng,
          sourceUrl: `https://mock.invalid/trail/${index + 1}`,
        })),
      };
    case "culture":
      return {
        visits: [
          ["Sample city museum", "Museum quarter", 90, "Seated galleries and a quiet cafe."],
          ["Sample small gallery", "Old town", 60, "A short, bookable visit."],
        ].map(([name, area, durationMin, why], index) => ({
          name,
          area,
          durationMin,
          why,
          booking: "Book a timed entry.",
          lat: place(index + 9).lat,
          lng: place(index + 9).lng,
          sourceUrl: `https://mock.invalid/visit/${index + 1}`,
        })),
      };
    case "transit":
      return {
        airportTransfer: "Take the airport train, then a short taxi to the hotel.",
        localTransit: "Use a reloadable transit card for short hops.",
        walkability: "The old town is walkable but has uneven paving.",
        taxi: "Use the official taxi app rather than street hails.",
        accessibility: "Confirm step-free access at the station before arrival.",
        notes: ["Keep transfers outside the hottest hours."],
        sources: [{ title: "Sample transit page", url: "https://mock.invalid/transit" }],
      };
    case "care":
      return {
        hospitals: [
          {
            name: "Sample central hospital",
            address: "1 Sample Street",
            lat: place(11).lat,
            lng: place(11).lng,
            phone: "+00 000 000",
            sourceUrl: "https://mock.invalid/hospital",
          },
        ],
        emergencyNumber: "112",
        localRisks: ["Summer heat can make midday walking uncomfortable."],
        notes: ["Confirm the hospital route before the first full day."],
        sources: [{ title: "Sample care page", url: "https://mock.invalid/care" }],
      };
  }
}

function mockResearch(request: PlannerRequest): Record<SpecialistAgentId, SpecialistResult> {
  const research = {} as Record<SpecialistAgentId, SpecialistResult>;
  for (const agentId of SPECIALIST_AGENT_IDS) {
    research[agentId] = normalizeSpecialistResult(agentId, mockRaw(agentId, request));
  }
  return research;
}

function mockConciergeRaw(
  request: PlannerRequest,
  research: Record<SpecialistAgentId, SpecialistResult>,
  caps: readonly PlannerCapInput[],
): unknown {
  const names = (agentId: SpecialistAgentId): string[] =>
    research[agentId].picks.map((pick: DraftPlace) => pick.name);
  const dining = names("table");
  const hikes = names("trail");
  const visits = names("culture");
  return {
    summary: `A ${request.days}-day sample plan for ${request.destination}, built around short walks, quiet meals, and recovery.`,
    baseArea: research.stay.picks[0]?.area ?? "",
    routeTheme: "One anchor a day with recovery built in",
    days: caps.map((cap, index) => {
      const day = index + 1;
      const restDay = request.days >= 4 && day === 3;
      const anchor = restDay ? null : [hikes[0], visits[0], hikes[1], visits[1]][index % 4];
      return {
        day,
        title: restDay ? "Sample rest day" : day === 1 ? "Sample arrival day" : "Sample paced day",
        area: research.stay.picks[0]?.area ?? "",
        restDay,
        stepEstimate: Math.round(cap.stepCap * (restDay ? 0.25 : 0.55)),
        walkingKm: Math.round(cap.walkingCapKm * (restDay ? 0.25 : 0.55) * 10) / 10,
        recoveryMinutes: CONDITION_PROFILES[request.condition].recoveryMinutes,
        blocks: [
          {
            time: "10:00",
            kind: anchor === hikes[0] || anchor === hikes[1] ? "hike" : "visit",
            title: anchor ?? "Rest and hydrate",
            detail: "A sample block from the mock plan.",
            durationMin: 90,
            placeName: anchor ?? null,
          },
          {
            time: "13:00",
            kind: "meal",
            title: dining[index % Math.max(1, dining.length)] ?? "Unhurried meal",
            detail: "A sample table near the route.",
            durationMin: 60,
            placeName: dining[index % Math.max(1, dining.length)] ?? null,
          },
          {
            time: "15:30",
            kind: "rest",
            title: "Recovery window",
            detail: "Rest, hydrate, and check for symptoms.",
            durationMin: CONDITION_PROFILES[request.condition].recoveryMinutes,
            placeName: null,
          },
        ],
      };
    }),
    selectedStays: names("stay"),
    selectedDining: names("table"),
    selectedHikes: names("trail"),
    selectedVisits: names("culture"),
    selectedCare: names("care"),
    safetyNotes: ["Mock data only. No real venue was checked."],
    bookingChecklist: ["Confirm hours and accessibility before booking."],
    budget: {
      level: request.budget,
      estimatedTotal: null,
      currency: "CAD",
      notes: "Mock plan; no real prices were checked.",
    },
  };
}

/** Builds a complete mock plan without any network call. */
export function buildMockPlan(
  request: PlannerRequest,
  caps: readonly PlannerCapInput[],
  nowIso: string,
): AgentTripPlan {
  const research = mockResearch(request);
  const plan = buildConciergePlan(
    mockConciergeRaw(request, research, caps),
    request,
    research,
    caps,
    nowIso,
  );
  return { ...plan, mock: true };
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

/** Emits a scripted mock run that exercises the same client and reducer path. */
export async function runMockPlanner(
  request: PlannerRequest,
  caps: readonly PlannerCapInput[],
  emit: (event: PlannerEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const mock = true as const;
  emitMock(emit, {
    event: "planner_started",
    data: { agents: PLANNER_AGENTS, ts: now(), mock },
  });
  for (const agent of PLANNER_AGENTS) {
    if (signal.aborted) return;
    emitMock(emit, {
      event: "agent_started",
      data: { agentId: agent.id, sessionId: `mock-${agent.id}`, ts: now(), mock },
    });
    emitMock(emit, {
      event: "agent_status",
      data: { agentId: agent.id, status: "researching", ts: now(), mock },
    });
    emitMock(emit, {
      event: "agent_activity",
      data: { agentId: agent.id, kind: "search", text: `Checking sample sources for ${agent.role.toLowerCase()}.`, ts: now(), mock },
    });
    await sleep(60, signal);
    emitMock(emit, {
      event: "agent_status",
      data: { agentId: agent.id, status: "writing", ts: now(), mock },
    });
    await sleep(60, signal);
    emitMock(emit, {
      event: "agent_result",
      data: {
        agentId: agent.id,
        ok: true,
        summary: agent.id === "concierge" ? "Sample route ready" : "Sample research ready",
        ts: now(),
        mock,
      },
    });
  }
  const plan = buildMockPlan(request, caps, now());
  const completed = PLANNER_AGENTS.map((agent) => agent.id);
  emitMock(emit, {
    event: "plan_ready",
    data: { plan, completed, failed: [], ts: now(), mock },
  });
  emitMock(emit, {
    event: "planner_done",
    data: { completed, failed: [], ts: now(), mock },
  });
}
