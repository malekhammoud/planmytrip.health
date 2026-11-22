"use client";

import { LinkButton } from "@/components/ui";
import {
  checkedStamp,
  formatMoney,
  hostOfUrl,
  menuPriceRange,
} from "@/lib/venue/format";
import type { PlannerPlace } from "@/lib/agent/agentTypes";
import type { VenueEvidence } from "@/lib/venue/types";

const CATEGORY_TITLE: Record<PlannerPlace["category"], string> = {
  stay: "Where to stay",
  eat: "Where to eat",
  hike: "Hikes and walks",
  visit: "Visits and experiences",
  care: "Care and emergency",
};

const CATEGORY_ORDER: readonly PlannerPlace["category"][] = [
  "stay",
  "eat",
  "hike",
  "visit",
  "care",
];

function metaLine(place: PlannerPlace): string {
  const parts: string[] = [];
  if (place.careType !== null) parts.push(place.careType);
  if (place.priceBand !== null) parts.push(place.priceBand);
  if (place.nights !== null) parts.push(`${place.nights} nights`);
  if (place.durationMin !== null) parts.push(`${place.durationMin} min`);
  if (place.distanceKm !== null) parts.push(`${place.distanceKm.toFixed(1)} km`);
  if (place.elevationM !== null) parts.push(`${Math.round(place.elevationM)} m gain`);
  if (place.difficulty !== null) parts.push(place.difficulty);
  if (place.geocoded === true) parts.push("approximate location");
  if (place.area) parts.push(place.area);
  return parts.join(" · ");
}

function CheckedVenueLine({ evidence }: { evidence: VenueEvidence }) {
  const line =
    evidence.kind === "hotel"
      ? `Room rate checked: ${formatMoney(evidence.nightlyRate, evidence.currency)} a night${
          evidence.total === null
            ? ""
            : ` · ${formatMoney(evidence.total, evidence.currency)} total`
        }`
      : `Menu checked: ${evidence.items.length} ${
          evidence.items.length === 1 ? "item" : "items"
        } · ${menuPriceRange(evidence.items)}`;
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-solid border-hairline pt-2">
      <p className="t-data-sm text-ink">{line}</p>
      <div className="flex flex-wrap items-center gap-3">
        <p className="t-data-sm text-muted">
          {hostOfUrl(evidence.sourceUrl, "source")} · checked{" "}
          {checkedStamp(evidence.retrievedAt)}
        </p>
        <LinkButton variant="ghost" size="sm" href={evidence.sourceUrl}>
          {evidence.kind === "hotel" ? "Open checked page" : "Open checked menu"}
        </LinkButton>
      </div>
    </div>
  );
}

function PickRow({
  place,
  evidence,
}: {
  place: PlannerPlace;
  evidence: VenueEvidence | undefined;
}) {
  const meta = metaLine(place);
  return (
    <li className="border-t border-hairline py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="t-heading text-ink">{place.name}</p>
        {meta ? <p className="t-data-sm text-muted">{meta}</p> : null}
      </div>
      {place.why ? <p className="t-small mt-1 text-muted">{place.why}</p> : null}
      {place.notes ? <p className="t-data-sm mt-1 text-muted">{place.notes}</p> : null}
      {place.address ? <p className="t-data-sm mt-1 text-muted">{place.address}</p> : null}
      {place.phone ? <p className="t-data-sm mt-1 text-muted">{place.phone}</p> : null}
      {place.booking ? <p className="t-data-sm mt-1 text-muted">{place.booking}</p> : null}
      {evidence === undefined ? null : <CheckedVenueLine evidence={evidence} />}
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {place.sourceUrl !== null ? (
          <a
            href={place.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center t-data text-accent [overflow-wrap:anywhere] hover:underline"
          >
            Source: {hostOfUrl(place.sourceUrl, "not found")}
          </a>
        ) : (
          <span className="t-data text-muted">Source: not found</span>
        )}
        {place.day !== null ? (
          <span className="t-data-sm text-muted">Day {place.day}</span>
        ) : null}
      </div>
    </li>
  );
}

/** Verified picks grouped by category, with checked venue facts where available. */
export function AgentPicks({
  places,
  evidence = [],
}: {
  places: readonly PlannerPlace[];
  evidence?: readonly VenueEvidence[];
}) {
  const sections = CATEGORY_ORDER.map((category) => ({
    category,
    items: places.filter((place) => place.category === category),
  })).filter((section) => section.items.length > 0);

  if (sections.length === 0) {
    return (
      <p className="t-small text-muted">
        No verified picks were returned. The day plan still shows the route.
      </p>
    );
  }

  const byPlace = new Map(
    evidence
      .filter((item) => item.placeId !== null)
      .map((item) => [item.placeId as string, item]),
  );

  return (
    <div className="mt-2 flex flex-col gap-8">
      {sections.map((section) => (
        <section key={section.category} aria-labelledby={`picks-${section.category}`}>
          <h4 id={`picks-${section.category}`} className="t-heading text-ink">
            {CATEGORY_TITLE[section.category]}
          </h4>
          <ul className="mt-2 list-none p-0">
            {section.items.map((place) => (
              <PickRow key={place.id} place={place} evidence={byPlace.get(place.id)} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
