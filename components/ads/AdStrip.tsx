/**
 * The compact house-ad strip used above the site footer.
 *
 * Inputs: one destination campaign and its prepared links.
 * Outputs: a dark, three-part advertisement that fits every page with a footer.
 * Invariants: one CTA per strip; no account or health data; the destination label is
 * the only personalization.
 */

import { LinkButton } from "@/components/ui";
import type { AdLayoutProps } from "./adTypes";

/** The destination strip shown above the closing notice on every page. */
export function AdStrip({
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
      <div className="page-container flex flex-col gap-4 py-5 md:flex-row md:items-center md:gap-8">
        <div className="shrink-0">
          <p className="t-label text-hairline">Advertisement · Destination desk</p>
          <p className="t-title mt-1 text-paper">{campaign.city}</p>
        </div>

        <div className="min-w-0 flex-1 border-t border-hairline pt-3 md:border-l md:border-t-0 md:pl-8 md:pt-0">
          <p className="t-heading text-paper">{campaign.headline}</p>
          <p className="t-small mt-1 text-hairline">{campaign.copy}</p>
          <p className="t-data-sm mt-2 text-hairline">{campaign.meta}</p>
        </div>

        <div className="flex flex-col gap-2 md:shrink-0 md:items-end">
          <LinkButton
            variant="accent"
            href={upgrade ? "/pricing" : planHref}
            onClick={upgrade ? onPricingClick : onPlanClick}
            data-cta={upgrade ? "ad_care_circle" : "ad_plan"}
            data-surface={placement}
            className="w-full md:w-auto"
          >
            {campaign.ctaLabel}
          </LinkButton>
          <p className="t-data-sm text-hairline md:text-right">{campaign.finePrint}</p>
        </div>
      </div>
    </div>
  );
}
