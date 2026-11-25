/**
 * The compact top-of-page house-ad bar used above the site header.
 *
 * Inputs: one destination campaign and its prepared links.
 * Outputs: a single-line, always-visible advertisement with the city and one CTA.
 * Invariants: one CTA, no health data, no image; the headline is hidden on small screens
 * where the city label and action must fit on one line.
 */

import { LinkButton } from "@/components/ui";
import type { AdLayoutProps } from "./adTypes";

/** The destination bar shown above the sticky site header. */
export function AdBar({
  campaign,
  intent,
  planHref,
  placement,
  onPlanClick,
  onPricingClick,
}: AdLayoutProps) {
  const upgrade = intent === "upgrade";
  return (
    <div className="bg-ink text-paper">
      <div className="page-container flex items-center gap-3 py-2">
        <p className="t-label shrink-0 text-hairline">
          Advertisement · {campaign.city}
        </p>
        <p className="t-small hidden min-w-0 flex-1 truncate text-paper md:block">
          {campaign.headline}
        </p>
        <LinkButton
          variant="accent"
          size="sm"
          href={upgrade ? "/pricing" : planHref}
          onClick={upgrade ? onPricingClick : onPlanClick}
          data-cta={upgrade ? "ad_care_circle" : "ad_plan"}
          data-surface={placement}
          className="ml-auto shrink-0"
        >
          {campaign.ctaLabel}
        </LinkButton>
      </div>
    </div>
  );
}
