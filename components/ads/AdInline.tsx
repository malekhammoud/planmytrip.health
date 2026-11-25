/**
 * The paper house-ad card used inside a page.
 *
 * Inputs: one destination campaign and its prepared links.
 * Outputs: a framed, ruled advertisement with a primary action and a plans link.
 * Invariants: the card never overlaps the surrounding route or plan; the fine print
 * keeps the planning-aid notice in view.
 */

import { LinkButton } from "@/components/ui";
import type { AdLayoutProps } from "./adTypes";

/** The inline destination card used on pricing and saved-trip pages. */
export function AdInline({
  campaign,
  intent,
  planHref,
  placement,
  onPlanClick,
  onPricingClick,
}: AdLayoutProps) {
  const upgrade = intent === "upgrade";
  return (
    <div className="rounded-frame border border-solid border-hairline bg-surface p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3">
        <p className="t-label text-muted">Advertisement · PlanMyTrip.health</p>
        <p className="t-data-sm text-muted">Destination desk / {campaign.city}</p>
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="min-w-0">
          <h3 className="t-title text-ink">{campaign.headline}</h3>
          <p className="t-small measure mt-2 text-muted">{campaign.copy}</p>
          <p className="t-data-sm mt-3 text-muted">{campaign.meta}</p>
          <p className="t-data-sm mt-1 text-muted">{campaign.finePrint}</p>
        </div>

        <div className="flex flex-col gap-2 md:min-w-[190px]">
          <LinkButton
            variant="primary"
            href={upgrade ? "/pricing" : planHref}
            onClick={upgrade ? onPricingClick : onPlanClick}
            data-cta={upgrade ? "ad_care_circle" : "ad_plan"}
            data-surface={placement}
            className="w-full"
          >
            {campaign.ctaLabel}
          </LinkButton>
          {upgrade ? null : (
            <LinkButton
              variant="ghost"
              href="/pricing"
              onClick={onPricingClick}
              data-cta="ad_plans"
              data-surface={placement}
              className="w-full"
            >
              See plans
            </LinkButton>
          )}
        </div>
      </div>
    </div>
  );
}
