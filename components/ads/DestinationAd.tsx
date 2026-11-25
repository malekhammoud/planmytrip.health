/**
 * Destination-personalized house advertisement.
 *
 * Inputs: an optional destination, an ad intent, a layout, a placement id, and whether
 * the reader is signed in.
 * Outputs: one labelled advertisement with a plan or Care Circle action.
 * Invariants: the destination comes from the current trip, the last planned destination
 * in local storage, or the browser time zone, in that order. No health profile is read.
 * The link opens the prefilled planner for a signed-in reader and sign-up for a visitor.
 */

"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  FEATURED_DESTINATIONS,
  campaignFor,
  featuredDestination,
  plannerHref,
  signUpHref,
  timezoneDestination,
  type AdIntent,
  type AdVariant,
} from "@/lib/ads/campaign";
import type { AdTarget } from "@/lib/ads/clickEvent";
import {
  AD_DESTINATION_EVENT,
  readAdDestination,
} from "@/lib/ads/destinationMemory";
import { trackAdClick } from "@/lib/ads/trackClick";
import { AdInline } from "./AdInline";
import { AdPoster } from "./AdPoster";
import { AdStrip } from "./AdStrip";

/** Props for {@link DestinationAd}. */
export interface DestinationAdProps {
  /** A trip destination. When absent, the ad recalls the last planned destination. */
  destination?: string;
  /** `plan` asks for a trip start; `upgrade` sells Care Circle. Defaults to plan. */
  intent?: AdIntent;
  /** Layout to render. Defaults to the inline card. */
  variant?: AdVariant;
  /** Stable placement id, such as `landing` or `site-footer`. */
  placement: string;
  /** True when the reader already has an account, so the planner can open directly. */
  signedIn?: boolean;
  /** Optional wrapper class. */
  className?: string;
}

/**
 * Resolves the city for an ad. The server snapshot is the first featured destination;
 * after hydration React reads the traveler's local destination or time zone. The
 * external store is intentionally read-only, so no effect has to write state.
 */
function clientDestination(): string {
  const remembered = readAdDestination();
  if (remembered !== null) return remembered;
  let zone: string | null = null;
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    zone = null;
  }
  return timezoneDestination(zone) ?? featuredDestination();
}

function subscribeToDestination(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(AD_DESTINATION_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(AD_DESTINATION_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function useAdDestination(provided?: string): string {
  const clean = provided?.trim() ?? "";
  const resolved = useSyncExternalStore(
    subscribeToDestination,
    () => (clean.length > 0 ? clean : clientDestination()),
    () => FEATURED_DESTINATIONS[0],
  );
  return clean.length > 0 ? clean : resolved;
}

/** One first-party destination advertisement. */
export function DestinationAd({
  destination,
  intent = "plan",
  variant = "inline",
  placement,
  signedIn = false,
  className,
}: DestinationAdProps) {
  const resolved = useAdDestination(destination);
  const campaign = useMemo(() => campaignFor(resolved, intent), [resolved, intent]);
  const href = signedIn
    ? plannerHref(campaign.destination)
    : signUpHref(campaign.destination);
  const trackingDestination =
    campaign.country.length > 0
      ? `${campaign.city}, ${campaign.country}`
      : campaign.city;

  const track = (target: AdTarget): void => {
    trackAdClick({
      destination: trackingDestination,
      placement,
      intent,
      variant,
      target,
    });
  };

  const layout = {
    campaign,
    intent,
    planHref: href,
    onPlanClick: () => track("plan"),
    onPricingClick: () => track("pricing"),
  };

  return (
    <aside
      aria-label={`Advertisement from PlanMyTrip.health for ${campaign.city}`}
      className={className}
    >
      {variant === "poster" ? (
        <AdPoster {...layout} />
      ) : variant === "strip" ? (
        <AdStrip {...layout} />
      ) : (
        <AdInline {...layout} />
      )}
    </aside>
  );
}
