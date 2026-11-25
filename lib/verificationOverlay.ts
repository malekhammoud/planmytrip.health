/**
 * Tighten-only verification overlay.
 *
 * Inputs: an engine plan, the condition, completed verification findings, and toggle
 * options. Outputs: a new plan with verified notes and possibly longer recovery windows,
 * plus the typed adjustments the interface can enable or disable.
 * Invariants: the overlay never changes a step ceiling, walking ceiling, or score; it
 * never shortens recovery; unmatched or null findings produce no adjustment; adjustment
 * ids, order, and reason text are deterministic; and applying the result again is a no-op.
 */

import { CONDITION_PROFILES } from "@/lib/conditionProfiles";
import type { HealthTripPlan } from "@/lib/healthTripEngine";
import type { Condition } from "@/lib/types";
import type {
  AdvisoryFindings,
  SwarmFindings,
  WorkerId,
} from "@/lib/swarmTypes";

/** Engine category a keyword rule maps to. */
export type AdjustmentCategory =
  | "heat"
  | "air_quality"
  | "altitude"
  | "outbreak"
  | "allergen";

/** One deterministic keyword rule. */
export interface AdjustmentRule {
  id: string;
  category: AdjustmentCategory;
  label: string;
  pattern: RegExp;
  /** What to confirm against current guidance. */
  verify: string;
}

/**
 * Ordered keyword rules. The first matching rule per category is used, so the result
 * does not depend on the order of the upstream lists.
 */
// VERIFY: These are product keyword heuristics, not clinical thresholds. Have a
// clinician confirm that heat, air quality, altitude, outbreak, and allergen wording
// from a government advisory maps to the intended pacing response.
export const ADJUSTMENT_RULES: readonly AdjustmentRule[] = [
  {
    id: "heat",
    category: "heat",
    label: "Heat notice",
    pattern: /\b(?:heat|heatwave|heat wave|hot weather|humidex|extreme temperature)\b/i,
    verify: "Confirm that a heat notice should extend recovery for this condition.",
  },
  {
    id: "air-quality",
    category: "air_quality",
    label: "Air-quality notice",
    pattern: /\b(?:air quality|smoke|smog|pollution|wildfire|particulate|pollen)\b/i,
    verify: "Confirm that an air-quality notice should extend recovery for this condition.",
  },
  {
    id: "altitude",
    category: "altitude",
    label: "Altitude notice",
    pattern: /\b(?:altitude|elevation|mountain|thin air)\b/i,
    verify: "Confirm that an altitude notice belongs on the day checkpoint.",
  },
  {
    id: "outbreak",
    category: "outbreak",
    label: "Health-outbreak notice",
    pattern: /\b(?:outbreak|measles|dengue|malaria|cholera|zika|yellow fever|covid|influenza)\b/i,
    verify: "Confirm that an outbreak notice belongs on the day checkpoint.",
  },
  {
    id: "allergen",
    category: "allergen",
    label: "Allergen notice",
    pattern:
      /\b(?:allergen|food safety|peanut|shellfish|dairy|unpasteuri[sz]ed|undercooked)\b/i,
    verify: "Confirm that an allergen or food-safety notice belongs on the day checkpoint.",
  },
];

const CATEGORY_LABEL: Record<AdjustmentCategory, string> = {
  heat: "heat notice",
  air_quality: "air-quality notice",
  altitude: "altitude notice",
  outbreak: "outbreak notice",
  allergen: "allergen notice",
};

/**
 * Conditions whose profile lists the sensitivity. Heat, altitude, and outbreak apply
 * broadly; air quality is respiratory; the POTS profile explicitly has no condition-wide
 * allergen.
 */
const SENSITIVE: Record<AdjustmentCategory, readonly Condition[]> = {
  heat: ["asthma_respiratory", "chronic_fatigue_pots", "pregnancy_second_trimester", "severe_food_allergy", "cardiac_hypertension"],
  air_quality: ["asthma_respiratory"],
  altitude: ["asthma_respiratory", "chronic_fatigue_pots", "pregnancy_second_trimester", "severe_food_allergy", "cardiac_hypertension"],
  outbreak: ["asthma_respiratory", "chronic_fatigue_pots", "pregnancy_second_trimester", "severe_food_allergy", "cardiac_hypertension"],
  allergen: ["asthma_respiratory", "pregnancy_second_trimester", "severe_food_allergy", "cardiac_hypertension"],
};

/** Recovery extension added once per day when a heat or air-quality rule applies. */
export const RECOVERY_EXTENSION_MINUTES = 30;

const MAX_CHECKPOINT_ADJUSTMENTS = 3;

/** One completed worker's findings, as consumed by the overlay. */
export interface VerificationFindingInput {
  worker: WorkerId;
  findings: SwarmFindings;
  sourceUrl: string;
  retrievedAt: string;
}

/** Toggle state for the overlay. */
export interface OverlayOptions {
  /** Master switch; false keeps the base plan and marks every adjustment off. */
  master?: boolean;
  /** Adjustment ids the reader switched off. */
  disabledIds?: readonly string[];
}

/** One applied or available adjustment. */
export interface VerificationAdjustment {
  id: string;
  kind: "checkpoint" | "recovery";
  /** Zero-based day index for a recovery adjustment. */
  dayIndex?: number;
  /** Short title for the adjustment list. */
  title: string;
  reason: string;
  sourceUrl: string;
  sourceWorker: WorkerId;
  retrievedAt: string;
  applied: boolean;
  /** Recovery minutes before and after, only on recovery adjustments. */
  fromValue?: number;
  toValue?: number;
}

/** Overlay result; the plan is a new object even when nothing changed. */
export interface VerificationOverlay {
  plan: HealthTripPlan;
  adjustments: VerificationAdjustment[];
}

interface Match {
  rule: AdjustmentRule;
  text: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function matchRules(findings: SwarmFindings): Match[] {
  if (!isRecord(findings)) return [];
  const hazards = Array.isArray(findings.environmentalHazards)
    ? findings.environmentalHazards.filter((value): value is string => typeof value === "string")
    : [];
  const notices = Array.isArray(findings.healthNotices)
    ? findings.healthNotices.filter((value): value is string => typeof value === "string")
    : [];
  const summary = typeof findings.riskSummary === "string" ? [findings.riskSummary] : [];
  const texts = [...hazards, ...notices, ...summary];
  const matches: Match[] = [];
  const seen = new Set<AdjustmentCategory>();
  for (const rule of ADJUSTMENT_RULES) {
    if (seen.has(rule.category)) continue;
    const text = texts.find((entry) => rule.pattern.test(entry));
    if (text === undefined) continue;
    seen.add(rule.category);
    matches.push({ rule, text: text.trim().slice(0, 160) });
  }
  return matches;
}

/** Extracts a display host without importing UI code. */
function sourceHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "the source page";
  }
}

function clonePlan(plan: HealthTripPlan): HealthTripPlan {
  return {
    ...plan,
    itinerary: plan.itinerary.map((day) => ({
      ...day,
      blocks: day.blocks.map((block) => ({ ...block })),
    })),
  };
}

function enabled(id: string, options: OverlayOptions): boolean {
  if (options.master === false) return false;
  return !(options.disabledIds ?? []).includes(id);
}

/**
 * Applies the overlay. A checkpoint adjustment appends one verified note to every day's
 * checkpoint; a recovery adjustment extends that day's recovery block to the profile
 * minimum plus 30 minutes.
 */
export function applyVerification(
  plan: HealthTripPlan,
  input: { condition: Condition },
  findings: readonly VerificationFindingInput[] | null | undefined,
  options: OverlayOptions = {},
): VerificationOverlay {
  const next = clonePlan(plan);
  const adjustments: VerificationAdjustment[] = [];
  if (!findings || findings.length === 0) return { plan: next, adjustments };

  const advisory = findings.find((entry) => entry.worker === "advisory");
  const matches = advisory === undefined ? [] : matchRules(advisory.findings);
  const profile = CONDITION_PROFILES[input.condition];

  for (const match of matches.slice(0, MAX_CHECKPOINT_ADJUSTMENTS)) {
    const id = `checkpoint:${match.rule.id}`;
    const host = sourceHost(advisory?.sourceUrl ?? "");
    const clean = match.text.replace(/[.!?]+$/, "");
    const note = `Verified note: ${match.rule.label} — ${clean}. Source: ${host}.`;
    const applied = enabled(id, options);
    if (applied) {
      next.itinerary = next.itinerary.map((day) =>
        day.healthCheckpoint.includes(`Verified note: ${match.rule.label}`)
          ? day
          : { ...day, healthCheckpoint: `${day.healthCheckpoint} ${note}` },
      );
    }
    adjustments.push({
      id,
      kind: "checkpoint",
      title: match.rule.label,
      reason: match.text,
      sourceUrl: advisory?.sourceUrl ?? "",
      sourceWorker: "advisory",
      retrievedAt: advisory?.retrievedAt ?? "",
      applied,
    });
  }

  const recoveryRule = matches.find(
    (match) =>
      (match.rule.category === "heat" || match.rule.category === "air_quality") &&
      SENSITIVE[match.rule.category].includes(input.condition),
  );
  if (recoveryRule !== undefined) {
    for (const [index, day] of next.itinerary.entries()) {
      const recovery = day.blocks.find((block) => block.kind === "recovery");
      if (recovery === undefined) continue;
      const id = `recovery:${day.day}`;
      const applied = enabled(id, options);
      const before = recovery.durationMin;
      const after = profile.recoveryMinutes + RECOVERY_EXTENSION_MINUTES;
      if (applied && before < after) recovery.durationMin = after;
      adjustments.push({
        id,
        kind: "recovery",
        dayIndex: index,
        title: "Recovery extension",
        reason: matchReason(recoveryRule),
        sourceUrl: advisory?.sourceUrl ?? "",
        sourceWorker: "advisory",
        retrievedAt: advisory?.retrievedAt ?? "",
        applied,
        fromValue: before,
        toValue: applied ? Math.max(before, after) : before,
      });
    }
  }

  return { plan: next, adjustments };
}

function matchReason(match: Match): string {
  return `${CATEGORY_LABEL[match.rule.category]}: ${match.text}`;
}

/** Human label for a category, used by the adjustment list and tests. */
export function adjustmentCategoryLabel(category: AdjustmentCategory): string {
  return CATEGORY_LABEL[category];
}

/** Re-exported for callers that already hold advisory findings. */
export type { AdvisoryFindings };
