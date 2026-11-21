/**
 * Canonical condition vocabulary shared by the pacing engine, the API route,
 * and the interface. This is the only module that defines condition identifiers.
 *
 * Inputs: none. Outputs: CONDITIONS, Condition, CONDITION_LABELS, isCondition.
 * Invariant: every Condition has exactly one human label from CONDITION_LABELS.
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
  asthma_respiratory: "asthma or respiratory conditions",
  chronic_fatigue_pots: "chronic fatigue or POTS",
  pregnancy_second_trimester: "second-trimester pregnancy",
  severe_food_allergy: "severe food allergy",
  cardiac_hypertension: "cardiac conditions or hypertension",
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
