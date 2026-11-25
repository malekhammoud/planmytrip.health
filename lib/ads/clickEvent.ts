/**
 * Validation for one aggregate house-ad click.
 *
 * Inputs: untrusted JSON from a beacon or fetch.
 * Outputs: a bounded click event or null.
 * Invariants: only a destination label, a placement id, the campaign intent, the layout,
 * and the click target survive. No account id, IP address, health field, or free text.
 */

import {
  safeDestination,
  type AdIntent,
  type AdVariant,
} from "./campaign";

/** The CTA that was clicked. */
export type AdTarget = "plan" | "pricing";

/** One validated aggregate ad click. */
export interface AdClickEvent {
  destination: string;
  placement: string;
  intent: AdIntent;
  variant: AdVariant;
  target: AdTarget;
}

const PLACEMENT = /^[a-z0-9-]{1,40}$/;
const INTENTS = new Set<AdIntent>(["plan", "upgrade"]);
const VARIANTS = new Set<AdVariant>(["poster", "strip", "bar", "inline"]);
const TARGETS = new Set<AdTarget>(["plan", "pricing"]);

/** Returns the validated event, or null when any field is missing or out of bounds. */
export function parseAdClick(value: unknown): AdClickEvent | null {
  if (value === null || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const destination = safeDestination(source.destination);
  const placement = typeof source.placement === "string" ? source.placement.trim() : "";
  const intent = source.intent;
  const variant = source.variant;
  const target = source.target;
  if (destination === null || !PLACEMENT.test(placement)) return null;
  if (typeof intent !== "string" || !INTENTS.has(intent as AdIntent)) return null;
  if (typeof variant !== "string" || !VARIANTS.has(variant as AdVariant)) return null;
  if (typeof target !== "string" || !TARGETS.has(target as AdTarget)) return null;
  return {
    destination,
    placement,
    intent: intent as AdIntent,
    variant: variant as AdVariant,
    target: target as AdTarget,
  };
}
