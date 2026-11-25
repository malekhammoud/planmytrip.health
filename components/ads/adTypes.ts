/**
 * Shared props for the house-ad layouts.
 *
 * Inputs: one campaign, the campaign intent, and the two prepared click handlers.
 * Outputs: a typed contract for the poster, strip, and inline ads.
 * Invariants: layouts do not resolve destinations or call analytics themselves; the
 * wrapper owns both so every placement reports the same fields.
 */

import type { AdIntent, DestinationCampaign } from "@/lib/ads/campaign";

/** Props every house-ad layout receives. */
export interface AdLayoutProps {
  campaign: DestinationCampaign;
  intent: AdIntent;
  planHref: string;
  /** Stable placement id carried into first-party CTA analytics. */
  placement: string;
  onPlanClick: () => void;
  onPricingClick: () => void;
}
