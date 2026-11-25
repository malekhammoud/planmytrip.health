/**
 * The large editorial house-ad poster.
 *
 * Inputs: one destination campaign and its prepared links.
 * Outputs: a dark, ruled, typographic advertisement with a campaign file.
 * Invariants: no image, gradient, or box effect; no health data. The city is the display
 * element; the copy stays a planning aid.
 */

import { LogoMark } from "@/components/Logo";
import { LinkButton } from "@/components/ui";
import type { AdLayoutProps } from "./adTypes";

/** The full-width destination poster used on the landing page. */
export function AdPoster({
  campaign,
  intent,
  planHref,
  placement,
  onPlanClick,
  onPricingClick,
}: AdLayoutProps) {
  const upgrade = intent === "upgrade";
  return (
    <div className="overflow-hidden rounded-frame bg-ink text-paper">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-5 py-3 md:px-8">
        <p className="t-label text-hairline">Advertisement · PlanMyTrip.health</p>
        <p className="t-label text-hairline">Destination desk / No. {campaign.issue}</p>
      </div>

      <div className="grid gap-8 px-5 py-8 md:px-8 md:py-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-12">
        <div className="min-w-0">
          <p className="ad-poster-city text-paper">{campaign.city}</p>
          <p className="t-data mt-3 text-hairline">
            {campaign.country.length > 0 ? campaign.country : "Health-aware trip planning"}
          </p>
          <h2 className="t-title mt-6 max-w-[24ch] text-paper">{campaign.headline}</h2>
          <p className="t-body measure mt-4 text-hairline">{campaign.copy}</p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <LinkButton
              variant="accent"
              href={upgrade ? "/pricing" : planHref}
              onClick={upgrade ? onPricingClick : onPlanClick}
              data-cta={upgrade ? "ad_care_circle" : "ad_plan"}
              data-surface={placement}
              className="w-full sm:w-auto"
            >
              {campaign.ctaLabel}
            </LinkButton>
            {upgrade ? null : (
              <a
                href="/pricing"
                onClick={onPricingClick}
                data-cta="ad_plans"
                data-surface={placement}
                className="t-button inline-flex min-h-11 items-center justify-center text-paper underline underline-offset-4"
              >
                See plans
              </a>
            )}
          </div>
          <p className="t-data-sm mt-5 text-hairline">{campaign.meta}</p>
        </div>

        <div className="border-t border-hairline pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <div className="flex items-center justify-between gap-3">
            <LogoMark size={34} className="text-paper" />
            <p className="t-label text-hairline">Campaign file</p>
          </div>
          <dl className="mt-5 border-t border-hairline">
            {campaign.rows.map((row) => (
              <div
                key={row.term}
                className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] gap-3 border-b border-hairline py-2"
              >
                <dt className="t-data-sm text-hairline">{row.term}</dt>
                <dd className="t-small text-paper">{row.detail}</dd>
              </div>
            ))}
          </dl>
          <p className="t-data-sm mt-4 text-hairline">{campaign.finePrint}</p>
        </div>
      </div>

      <div className="border-t border-hairline px-5 py-2 md:px-8">
        <p className="t-label text-hairline">
          {campaign.city}
          {campaign.country.length > 0 ? ` / ${campaign.country}` : ""} / Health-aware
          trip planning
        </p>
      </div>
    </div>
  );
}
