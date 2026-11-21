/**
 * Fallback itinerary assembled from verified research when synthesis fails.
 *
 * Inputs: the validated request, specialist research, engine caps, recovery minutes,
 * and a timestamp. Outputs: a complete AgentTripPlan marked degraded.
 * Invariants: every place still comes from research; estimates stay below the engine
 * ceilings; no venue or coordinate is invented; the UI labels the plan as degraded.
 */

import {
  type AgentTripPlan,
  type PlannerCapInput,
  type PlannerDay,
  type PlannerDayBlock,
  type PlannerPlace,
  type PlannerRequest,
  type PlannerSource,
  type SpecialistAgentId,
} from "./agentTypes";
import { finalizePlace, type DraftPlace, type SpecialistResult } from "./agentParse";

interface FallbackInput {
  request: PlannerRequest;
  research: Partial<Record<SpecialistAgentId, SpecialistResult>>;
  caps: readonly PlannerCapInput[];
  recoveryMinutes: number;
  now: string;
}

function allPicks(
  research: Partial<Record<SpecialistAgentId, SpecialistResult>>,
): DraftPlace[] {
  return Object.values(research).flatMap((entry) => entry?.picks ?? []);
}

function block(
  time: string,
  kind: PlannerDayBlock["kind"],
  title: string,
  detail: string,
  durationMin: number,
  placeId: string | null,
): PlannerDayBlock {
  return { time, kind, title, detail, durationMin, placeId };
}

function sourcesFromPlaces(places: readonly PlannerPlace[]): PlannerSource[] {
  const seen = new Set<string>();
  const sources: PlannerSource[] = [];
  for (const place of places) {
    if (place.sourceUrl === null || seen.has(place.sourceUrl)) continue;
    seen.add(place.sourceUrl);
    sources.push({ title: place.name, url: place.sourceUrl });
  }
  return sources;
}

/** Builds a conservative fallback route from the verified picks. */
export function buildFallbackPlan(input: FallbackInput): AgentTripPlan {
  const picks = allPicks(input.research);
  const stays = picks.filter((pick) => pick.category === "stay");
  const dining = picks.filter((pick) => pick.category === "eat");
  const hikes = picks.filter((pick) => pick.category === "hike");
  const visits = picks.filter((pick) => pick.category === "visit");
  const care = picks.filter((pick) => pick.category === "care");
  const chosen = [
    ...stays.slice(0, 1),
    ...dining.slice(0, Math.min(6, Math.max(2, input.request.days))),
    ...hikes.slice(0, 2),
    ...visits.slice(0, 4),
    ...care.slice(0, 4),
  ];
  const places = chosen.map((draft, index) => finalizePlace(draft, index, null));
  const byCategory = (category: PlannerPlace["category"]): PlannerPlace[] =>
    places.filter((place) => place.category === category);
  const stayPlaces = byCategory("stay");
  const eatPlaces = byCategory("eat");
  const hikePlaces = byCategory("hike");
  const visitPlaces = byCategory("visit");
  const carePlaces = byCategory("care");

  const days: PlannerDay[] = input.caps.map((cap, index) => {
    const day = index + 1;
    const restDay = input.request.days >= 4 && day % 3 === 0 && day < input.request.days;
    const anchor = restDay
      ? null
      : hikePlaces[(day - 1) % Math.max(1, hikePlaces.length)] ??
        visitPlaces[(day - 1) % Math.max(1, visitPlaces.length)] ??
        null;
    const meal = eatPlaces[index % Math.max(1, eatPlaces.length)] ?? null;
    const stay = stayPlaces[0] ?? null;
    const care = carePlaces[index % Math.max(1, carePlaces.length)] ?? null;
    const blocks: PlannerDayBlock[] = [];
    if (day === 1) {
      blocks.push(
        block(
          "15:00",
          "stay",
          stay?.name ?? "Check in and unpack",
          stay?.area ?? "Settle in near the base area.",
          45,
          stay?.id ?? null,
        ),
      );
    }
    if (anchor !== null) {
      blocks.push(
        block(
          "10:00",
          anchor.category === "hike" ? "hike" : "visit",
          anchor.name,
          anchor.why || "A verified low-exertion anchor for the day.",
          anchor.durationMin ?? 90,
          anchor.id,
        ),
      );
    }
    if (meal !== null) {
      blocks.push(
        block(
          "13:00",
          "meal",
          meal.name,
          meal.why || "A verified table near the route.",
          60,
          meal.id,
        ),
      );
    }
    if (care !== null && day === 1) {
      blocks.push(
        block(
          "17:00",
          "care",
          care.name,
          care.address ?? "Confirm the route to care before the first full day.",
          30,
          care.id,
        ),
      );
    }
    blocks.push(
      block(
        "15:30",
        "rest",
        "Recovery window",
        "Rest, hydrate, and check for symptoms before the evening.",
        input.recoveryMinutes,
        null,
      ),
    );
    if (day === input.request.days) {
      blocks.push(
        block(
          "18:00",
          "transit",
          "Return transfer",
          "Keep the transfer unhurried and medication within reach.",
          30,
          null,
        ),
      );
    }
    const factor = restDay ? 0.25 : 0.55;
    const placeIds = new Set(blocks.map((item) => item.placeId).filter((id): id is string => id !== null));
    for (const place of places) {
      if (placeIds.has(place.id) && place.day === null) place.day = day;
    }
    return {
      day,
      title: restDay
        ? `Rest day in ${input.request.destination}`
        : day === 1
          ? `Arrival and base in ${input.request.destination}`
          : `Paced day in ${input.request.destination}`,
      area: stay?.area ?? "",
      restDay,
      stepEstimate: Math.round(cap.stepCap * factor),
      walkingKm: Math.round(cap.walkingCapKm * factor * 10) / 10,
      recoveryMinutes: input.recoveryMinutes,
      blocks,
      stepCeiling: cap.stepCap,
      walkingCapKm: cap.walkingCapKm,
      withinCaps: true,
      checkpoint: cap.checkpoint,
    };
  });

  return {
    summary: `A conservative ${input.request.days}-day plan assembled from verified research. The concierge route did not finish.`,
    baseArea: stayPlaces[0]?.area ?? "",
    routeTheme: "Research-led pacing with recovery built in",
    days,
    places,
    safetyNotes: [
      "Use the Pacing limits as the ceiling even where this plan estimates less.",
      ...carePlaces.flatMap((place) => (place.why ? [place.why] : [])),
    ].slice(0, 8),
    bookingChecklist: [
      "Confirm each venue's hours, accessibility, and cancellation terms before booking.",
    ],
    budget: {
      level: input.request.budget,
      estimatedTotal: null,
      currency: "CAD",
      notes: "A full budget estimate was not available.",
    },
    sources: sourcesFromPlaces(places),
    generatedAt: input.now,
    degraded: true,
  };
}
