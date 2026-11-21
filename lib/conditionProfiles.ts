/**
 * Condition-specific modeled planning limits for PlanMyTrip.health.
 *
 * Inputs: none. Outputs: CONDITION_PROFILES, DEFAULT_MEDICATION_BY_CONDITION, and
 * MEDICATION_DISCLAIMER. Invariant: every supported Condition has exactly one typed
 * profile; all modeled physiological limits live in CONDITION_PROFILES. Values are
 * planning limits, not clinical prescriptions, and are not clinically validated.
 */

import type { Condition } from "./types";
import type { ConditionProfile } from "./healthTripTypes";

/**
 * The single source of condition-specific physiological limits. Values are modeled
 * planning limits, not clinical prescriptions. Each profile carries its VERIFY line.
 */
export const CONDITION_PROFILES: Readonly<Record<Condition, ConditionProfile>> = {
  // VERIFY: Check the asthma step ceiling, walking cap, recovery length, altitude,
  // heat, allergen values, and residual-risk floor (22/100) against current
  // respiratory clinical guidance, then record the source in AGENTS.md section 9.
  asthma_respiratory: {
    dailyStepCeiling: 7000,
    maxWalkingKm: 4,
    mandatoryAfternoonRecovery: true,
    recoveryMinutes: 30,
    altitude: { maxMeters: 1500, note: "Thin air can worsen breathlessness; confirm a personal altitude limit." },
    heat: { cautionAboveCelsius: 28, note: "Heat and poor air quality can narrow airways; prefer cool hours." },
    allergens: {
      avoid: ["known personal allergens", "pollen-heavy parks", "smoke-filled rooms"],
      note: "Check local pollen and air-quality reports before outdoor blocks.",
    },
    residualRiskFloor: 22,
    rationale: "A breath-limited walking ceiling with a short afternoon recovery; check with a respiratory clinician. Modeled residual-risk floor: 22.",
  },
  // VERIFY: Check the POTS step ceiling, walking cap, 90-minute recovery, altitude,
  // heat, allergen values, and residual-risk floor (25/100) against current autonomic
  // clinical guidance, then record the source in AGENTS.md section 9.
  chronic_fatigue_pots: {
    dailyStepCeiling: 4000,
    maxWalkingKm: 2.5,
    mandatoryAfternoonRecovery: true,
    recoveryMinutes: 90,
    altitude: { maxMeters: 1200, note: "Altitude and heat can worsen orthostatic symptoms; confirm a limit." },
    heat: { cautionAboveCelsius: 26, note: "Heat can worsen lightheadedness; plan shade and fluids." },
    allergens: { avoid: ["known personal allergens"], note: "No condition-wide allergen; flag personal food triggers." },
    residualRiskFloor: 25,
    rationale: "A low daily load with a long afternoon recovery; check with the treating clinician. Modeled residual-risk floor: 25.",
  },
  // VERIFY: Check the second-trimester step ceiling, walking cap, recovery length,
  // altitude, heat, food-safety values, and residual-risk floor (18/100) against
  // current maternity clinical guidance, then record the source in AGENTS.md section 9.
  pregnancy_second_trimester: {
    dailyStepCeiling: 5000,
    maxWalkingKm: 3,
    mandatoryAfternoonRecovery: true,
    recoveryMinutes: 45,
    altitude: { maxMeters: 2000, note: "Confirm any altitude limit with the maternity clinician." },
    heat: { cautionAboveCelsius: 28, note: "Heat raises core temperature; rest in shade and hydrate." },
    allergens: {
      avoid: ["known personal allergens", "unpasteurized dairy", "undercooked meat"],
      note: "Food safety matters more than allergens; confirm with the maternity clinician.",
    },
    residualRiskFloor: 18,
    rationale: "A moderate load with scheduled rest, heat limits, and food-safety care; check with the maternity clinician. Modeled residual-risk floor: 18.",
  },
  // VERIFY: Check the food-allergy step ceiling, walking cap, recovery length, heat,
  // allergen values, and residual-risk floor (20/100) against current allergy clinical
  // guidance, then record the source in AGENTS.md section 9.
  severe_food_allergy: {
    dailyStepCeiling: 6000,
    maxWalkingKm: 3.5,
    mandatoryAfternoonRecovery: false,
    recoveryMinutes: 30,
    altitude: { maxMeters: 2500, note: "No allergy-specific altitude limit; confirm personal tolerance." },
    heat: { cautionAboveCelsius: 32, note: "Heat can complicate reaction management; plan shorter outdoor blocks." },
    allergens: {
      avoid: ["known personal allergens", "unlabelled foods", "high cross-contact kitchens"],
      note: "Avoid unlabelled foods and high cross-contact kitchens.",
    },
    residualRiskFloor: 20,
    rationale: "A moderate load with flexible recovery; emergency planning matters more than exertion. Modeled residual-risk floor: 20.",
  },
  // VERIFY: Check the cardiac step ceiling, walking cap, recovery length, altitude,
  // heat, sodium/allergen values, and residual-risk floor (22/100) against current
  // cardiology clinical guidance, then record the source in AGENTS.md section 9.
  cardiac_hypertension: {
    dailyStepCeiling: 5000,
    maxWalkingKm: 3,
    mandatoryAfternoonRecovery: true,
    recoveryMinutes: 45,
    altitude: { maxMeters: 1500, note: "Confirm an altitude limit with the cardiology clinician." },
    heat: { cautionAboveCelsius: 28, note: "Heat adds cardiac workload; avoid the hottest hours." },
    allergens: { avoid: ["known personal allergens", "high-sodium meals"], note: "Keep meals moderate; confirm sodium and personal allergens." },
    residualRiskFloor: 22,
    rationale: "A moderate load with a midday recovery and altitude limits; check with the cardiology clinician. Modeled residual-risk floor: 22.",
  },
};

/** Common generic medication names by condition. Names only; never doses. */
export const DEFAULT_MEDICATION_BY_CONDITION: Readonly<Record<Condition, string>> = {
  asthma_respiratory: "albuterol",
  chronic_fatigue_pots: "fludrocortisone",
  pregnancy_second_trimester: "prenatal vitamins",
  severe_food_allergy: "epinephrine",
  cardiac_hypertension: "lisinopril",
};

/** Plain-language limits on what medication information this planner may show. */
export const MEDICATION_DISCLAIMER =
  "Medication names are examples only. This planner does not give doses or medication changes. Confirm all medication decisions with your clinician and pharmacist.";
