/**
 * Wire contracts for the OpenCode concierge planner.
 *
 * Inputs: none. Outputs: planner agent vocabulary, request and plan shapes, SSE event
 * payloads, and the pure frame encoder.
 * Invariants: every agent has one stable id and label; every payload carries an ISO
 * timestamp; plans contain only verified research picks; no medical claim is encoded here.
 */

import type { Condition, TransportMode } from "@/lib/types";

/** The seven planner agents, in display order. */
export const PLANNER_AGENT_IDS = [
  "stay",
  "table",
  "trail",
  "culture",
  "transit",
  "care",
  "concierge",
] as const;

/** One planner agent. */
export type PlannerAgentId = (typeof PLANNER_AGENT_IDS)[number];

/** The six research specialists; the concierge runs after them. */
export type SpecialistAgentId = Exclude<PlannerAgentId, "concierge">;

/** Research specialists, in display order. */
export const SPECIALIST_AGENT_IDS = PLANNER_AGENT_IDS.filter(
  (id): id is SpecialistAgentId => id !== "concierge",
);

/** Narrows an untrusted value to a planner agent id. */
export function isPlannerAgentId(value: unknown): value is PlannerAgentId {
  return (
    typeof value === "string" &&
    (PLANNER_AGENT_IDS as readonly string[]).includes(value)
  );
}

/** Narrows an untrusted value to a research specialist id. */
export function isSpecialistAgentId(value: unknown): value is SpecialistAgentId {
  return (
    isPlannerAgentId(value) &&
    (SPECIALIST_AGENT_IDS as readonly string[]).includes(value)
  );
}

/** Trip comfort level used by hotel and restaurant research. */
export type BudgetLevel = "value" | "balanced" | "premium";

/** Supported budget levels, in display order. */
export const BUDGET_LEVELS: readonly BudgetLevel[] = ["value", "balanced", "premium"];

/** Human labels for the budget control. */
export const BUDGET_LABELS: Readonly<Record<BudgetLevel, string>> = {
  value: "Value",
  balanced: "Balanced",
  premium: "Premium",
};

/** One planner agent's static presentation contract. */
export interface PlannerAgentMeta {
  id: PlannerAgentId;
  name: string;
  role: string;
  checks: string;
}

/** Agent roster shown before, during, and after a run. */
export const PLANNER_AGENTS: readonly PlannerAgentMeta[] = [
  {
    id: "stay",
    name: "Stay scout",
    role: "Hotels and base areas",
    checks: "Finds well-placed stays that shorten daily transfers and fit the budget.",
  },
  {
    id: "table",
    name: "Table scout",
    role: "Restaurants and food safety",
    checks: "Finds tables that fit the condition, budget, and each neighborhood.",
  },
  {
    id: "trail",
    name: "Trail scout",
    role: "Hikes and outdoor pacing",
    checks: "Finds gentle trails and the recovery day each route needs.",
  },
  {
    id: "culture",
    name: "Culture scout",
    role: "Sights and quiet experiences",
    checks: "Finds low-exertion visits that anchor each day without rushing.",
  },
  {
    id: "transit",
    name: "Transit scout",
    role: "Airport, local transit, access",
    checks: "Maps the easiest way to move around without overexertion.",
  },
  {
    id: "care",
    name: "Care scout",
    role: "Hospitals, pharmacies, emergency",
    checks: "Verifies care routes, emergency numbers, and local health risks.",
  },
  {
    id: "concierge",
    name: "Concierge",
    role: "Route, rest days, final plan",
    checks: "Sequences the research into a paced day-by-day trip.",
  },
];

/** Validated inputs for one concierge run. */
export interface PlannerRequest {
  destination: string;
  /** Free-text starting point, such as a home city or airport. May be empty. */
  origin: string;
  days: number;
  condition: Condition;
  medication: string;
  interests: string;
  budget: BudgetLevel;
  /** How the traveler expects to move between stops inside the destination. */
  transport: TransportMode;
  /** Start date in YYYY-MM-DD form, or empty when the traveler has not chosen one. */
  checkIn: string;
  /** Number of travelers, 1-8. */
  travelers: number;
  /** Opaque browser-generated id that joins the planner and swarm captures. */
  runId?: string;
  /** Anonymous install id for the local trip log. */
  installId?: string;
  /** Explicit opt-in for saving the trip dossier. */
  captureConsent?: boolean;
  /** Coverage answer used to build the captured engine plan. */
  hasSunLifeTravelCoverage?: boolean;
}

/** Complete trip configuration owned by the onboarding screen. */
export interface TripConfig extends PlannerRequest {
  hasSunLifeTravelCoverage: boolean;
  /** Explicit opt-in shown on the health step. */
  captureConsent: boolean;
}

/** Category used by map markers and pick lists. */
export type PlaceCategory = "stay" | "eat" | "hike" | "visit" | "care";

/** Care place subtype. */
export type CareType = "hospital" | "pharmacy";

/** One verified venue or resource in the final plan. */
export interface PlannerPlace {
  id: string;
  name: string;
  category: PlaceCategory;
  area: string;
  lat: number | null;
  lng: number | null;
  why: string;
  notes: string | null;
  priceBand: string | null;
  durationMin: number | null;
  nights: number | null;
  distanceKm: number | null;
  elevationM: number | null;
  difficulty: string | null;
  booking: string | null;
  /** Direct booking or official rate page, when the specialist found one. */
  bookingUrl?: string | null;
  /** Direct menu page, when the specialist found one. */
  menuUrl?: string | null;
  sourceUrl: string | null;
  address: string | null;
  phone: string | null;
  careType: CareType | null;
  day: number | null;
  /** True when coordinates came from the geocoder rather than the source page. */
  geocoded?: true;
}

/** Block kinds used by the concierge timeline. */
export type PlanBlockKind =
  | "transit"
  | "stay"
  | "meal"
  | "visit"
  | "hike"
  | "rest"
  | "care";

/** One titled block in a concierge day. */
export interface PlannerDayBlock {
  time: string;
  kind: PlanBlockKind;
  title: string;
  detail: string;
  durationMin: number;
  placeId: string | null;
}

/** One day's safety ceiling passed to the concierge. */
export interface PlannerCapInput {
  day: number;
  stepCap: number;
  walkingCapKm: number;
  checkpoint: string;
}

/** One concierge day with the engine's safety ceiling attached. */
export interface PlannerDay {
  day: number;
  title: string;
  area: string;
  restDay: boolean;
  stepEstimate: number;
  walkingKm: number;
  recoveryMinutes: number;
  blocks: PlannerDayBlock[];
  stepCeiling: number;
  walkingCapKm: number;
  withinCaps: boolean;
  checkpoint: string;
}

/** Budget summary for the finished plan. */
export interface PlannerBudget {
  level: BudgetLevel;
  estimatedTotal: number | null;
  currency: string;
  notes: string;
}

/** One cited source. */
export interface PlannerSource {
  title: string;
  url: string;
}

/** Complete concierge output rendered by the planner board. */
export interface AgentTripPlan {
  summary: string;
  baseArea: string;
  routeTheme: string;
  days: PlannerDay[];
  places: PlannerPlace[];
  safetyNotes: string[];
  bookingChecklist: string[];
  budget: PlannerBudget;
  sources: PlannerSource[];
  generatedAt: string;
  degraded?: boolean;
  mock?: true;
}

/** Stable failure codes the interface can branch on. */
export type PlannerErrorCode =
  | "agent_unavailable"
  | "invalid_request"
  | "invalid_plan"
  | "timeout"
  | "upstream_error";

/** Planner agent lifecycle phases. */
export type PlannerAgentPhase =
  | "idle"
  | "queued"
  | "researching"
  | "writing"
  | "complete"
  | "error";

/** Activity kinds shown in the live log. */
export type PlannerActivityKind = "search" | "read" | "note" | "tool" | "error";

/** Payload for planner_started: the roster and run mode. */
export interface PlannerStartedPayload {
  agents: readonly PlannerAgentMeta[];
  ts: string;
  mock?: true;
  /** True when the result was replayed from the verified cache. */
  cached?: true;
}

/** Payload for agent_started: a specialist session is open. */
export interface AgentStartedPayload {
  agentId: PlannerAgentId;
  sessionId: string;
  ts: string;
  mock?: true;
}

/** Payload for agent_status: phase movement with optional calm phase copy. */
export interface AgentStatusPayload {
  agentId: PlannerAgentId;
  status: PlannerAgentPhase;
  /** Short lifecycle copy, such as "Preparing the agent runtime". Never a secret. */
  message?: string;
  ts: string;
  mock?: true;
}

/** Payload for agent_activity: one human-readable research action. */
export interface AgentActivityPayload {
  agentId: PlannerAgentId;
  kind: PlannerActivityKind;
  text: string;
  ts: string;
  mock?: true;
}

/** Payload for agent_result: whether one specialist returned usable research. */
export interface AgentResultPayload {
  agentId: PlannerAgentId;
  ok: boolean;
  summary: string;
  ts: string;
  mock?: true;
  cached?: true;
}

/** Payload for plan_ready: the finished concierge plan. */
export interface PlanReadyPayload {
  plan: AgentTripPlan;
  completed: readonly PlannerAgentId[];
  failed: readonly PlannerAgentId[];
  ts: string;
  mock?: true;
  /** True when the plan was replayed from the verified cache. */
  cached?: true;
  /** When the live plan was produced and cached. */
  cachedAt?: string;
  /** Exact preference match, or a same-destination related match. */
  cacheMatch?: "exact" | "related";
}

/** Payload for planner_error: one calm failure. */
export interface PlannerErrorPayload {
  code: PlannerErrorCode;
  message: string;
  ts: string;
  mock?: true;
}

/** Payload for planner_done: always the last frame on a connected stream. */
export interface PlannerDonePayload {
  completed: readonly PlannerAgentId[];
  failed: readonly PlannerAgentId[];
  ts: string;
  mock?: true;
  cached?: true;
}

/** Names of the SSE events this route emits. */
export type PlannerEventName =
  | "planner_started"
  | "agent_started"
  | "agent_status"
  | "agent_activity"
  | "agent_result"
  | "plan_ready"
  | "planner_error"
  | "planner_done";

/** One server-sent planner event. */
export type PlannerEvent =
  | { event: "planner_started"; data: PlannerStartedPayload }
  | { event: "agent_started"; data: AgentStartedPayload }
  | { event: "agent_status"; data: AgentStatusPayload }
  | { event: "agent_activity"; data: AgentActivityPayload }
  | { event: "agent_result"; data: AgentResultPayload }
  | { event: "plan_ready"; data: PlanReadyPayload }
  | { event: "planner_error"; data: PlannerErrorPayload }
  | { event: "planner_done"; data: PlannerDonePayload };

/** Encodes one event as an SSE frame. JSON never contains a raw newline. */
export function encodePlannerEvent(event: PlannerEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
}
