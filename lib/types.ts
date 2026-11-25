/**
 * Canonical trip vocabulary shared by the pacing engine, the API route, the route
 * planner, and the interface. This is the only module that defines condition and
 * transport identifiers.
 *
 * Inputs: none. Outputs: CONDITIONS, Condition, CONDITION_LABELS, isCondition, and the
 * transport mode vocabulary used by onboarding and the route planner.
 * Invariant: every Condition and TransportMode has exactly one human label.
 */

/** The five supported condition groups, in stable display order. */
export const CONDITIONS = [
  "asthma_respiratory",
  "chronic_fatigue_pots",
  "pregnancy_second_trimester",
  "severe_food_allergy",
  "cardiac_hypertension",
] as const;

/** A supported condition group. */
export type Condition = (typeof CONDITIONS)[number];

/** Short, human-readable labels used by the select, the headline, and exports. */
export const CONDITION_LABELS = {
  asthma_respiratory: "asthma or breathing conditions",
  chronic_fatigue_pots: "fatigue or POTS",
  pregnancy_second_trimester: "second-trimester pregnancy",
  severe_food_allergy: "severe food allergy",
  cardiac_hypertension: "heart health or high blood pressure",
} as const satisfies Record<Condition, string>;

/**
 * Narrows untrusted input (route bodies, stored values) to a Condition.
 * Input: any value. Output: true only for one of the five identifiers.
 */
export function isCondition(value: unknown): value is Condition {
  return (
    typeof value === "string" && (CONDITIONS as readonly string[]).includes(value)
  );
}

/** How the traveler moves between stops inside the destination. */
export const TRANSPORT_MODES = ["walk", "transit", "car", "mixed"] as const;

/** A supported way of getting around. */
export type TransportMode = (typeof TRANSPORT_MODES)[number];

/** Labels for the onboarding select, the route panel, and the planner prompt. */
export const TRANSPORT_LABELS = {
  walk: "Walking",
  transit: "Public transit",
  car: "Car",
  mixed: "Mixed",
} as const satisfies Record<TransportMode, string>;

/** One calm sentence explaining what each mode assumes. */
export const TRANSPORT_HINTS = {
  walk: "Every stop is reachable on foot within your walking ceiling.",
  transit: "Trains, buses, and short walks between stops.",
  car: "Drive between stops and walk only at each place.",
  mixed: "Walk short hops and take transit or a car for longer ones.",
} as const satisfies Record<TransportMode, string>;

/**
 * Narrows untrusted input to a TransportMode. The planner falls back to mixed
 * rather than rejecting a request that predates this field.
 */
export function isTransportMode(value: unknown): value is TransportMode {
  return (
    typeof value === "string" && (TRANSPORT_MODES as readonly string[]).includes(value)
  );
}
