/**
 * Checked menu and hotel evidence cards for the venue deck.
 *
 * Inputs: bounded VenueEvidence rows.
 * Outputs: hotel quote cards with dated totals and source handoffs, plus menu cards with
 * grouped, priced items and the page's own allergen notes.
 * Invariants: missing values read "Not stated"; every row carries its source and checked
 * date; menu copy is attributed to the page and is not a clinical guarantee.
 */

"use client";

import { LinkButton } from "@/components/ui";
import {
  checkedStamp,
  formatMoney,
  hostOfUrl,
  menuPriceRange,
  menuSections,
} from "@/lib/venue/format";
import type {
  HotelEvidence,
  MenuEvidence,
  VenueEvidence,
} from "@/lib/venue/types";

function HotelCard({ hotel }: { hotel: HotelEvidence }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-frame border border-solid border-hairline-strong bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-b border-solid border-hairline px-4 py-3">
        <div>
          <p className="t-label text-muted">Hotel quote</p>
          <h4 className="t-heading mt-1 text-ink">{hotel.placeName}</h4>
        </div>
        <p className="t-data-sm text-right text-muted">
          {hotel.checkIn} to {hotel.checkOut}
          <br />
          {hotel.travelers} {hotel.travelers === 1 ? "traveller" : "travellers"}
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <p className="t-label text-muted">Nightly</p>
            <p className="t-title mt-1 text-ink">
              {formatMoney(hotel.nightlyRate, hotel.currency)}
            </p>
            <p className="t-data-sm mt-1 text-muted">
              {hotel.roomType ?? "Room type not stated"}
            </p>
          </div>
          <div className="text-right">
            <p className="t-label text-muted">Stay total</p>
            <p className="t-data mt-1 text-ink">
              {formatMoney(hotel.total, hotel.currency)}
            </p>
            <p className="t-data-sm mt-1 text-muted">
              Taxes and fees {formatMoney(hotel.taxesAndFees, hotel.currency)}
            </p>
          </div>
        </div>

        <dl className="flex flex-col">
          <div className="flex items-baseline justify-between gap-3 border-b border-solid border-hairline py-1">
            <dt className="t-data-sm text-muted">Booking host</dt>
            <dd className="t-data-sm text-right text-ink">
              {hostOfUrl(hotel.bookingUrl ?? hotel.sourceUrl, "Not stated")}
            </dd>
          </div>
          <div className="border-b border-solid border-hairline py-1">
            <dt className="t-data-sm text-muted">Cancellation</dt>
            <dd className="t-small mt-1 text-ink">{hotel.cancellation ?? "Not stated"}</dd>
          </div>
        </dl>

        {hotel.notes.length > 0 ? (
          <ul className="flex list-none flex-col gap-1 p-0">
            {hotel.notes.slice(0, 3).map((note) => (
              <li key={note} className="t-small text-muted">
                {note}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-solid border-hairline pt-3">
          <LinkButton
            variant="ghost"
            size="sm"
            href={hotel.bookingUrl ?? hotel.sourceUrl}
          >
            Open booking page
          </LinkButton>
          <p className="t-data-sm text-muted">
            Checked {checkedStamp(hotel.retrievedAt)}
          </p>
        </div>
      </div>
    </article>
  );
}

function MenuCard({ menu }: { menu: MenuEvidence }) {
  const sections = menuSections(menu.items);
  return (
    <article className="flex flex-col overflow-hidden rounded-frame border border-solid border-hairline-strong bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-b border-solid border-hairline px-4 py-3">
        <div>
          <p className="t-label text-muted">Checked menu</p>
          <h4 className="t-heading mt-1 text-ink">{menu.placeName}</h4>
        </div>
        <p className="t-data-sm text-right text-muted">
          {menu.items.length} {menu.items.length === 1 ? "item" : "items"}
          <br />
          {menuPriceRange(menu.items)}
        </p>
      </div>

      {sections.length > 0 ? (
        <div className="max-h-[420px] overflow-y-auto px-4 py-2">
          {sections.map((section) => (
            <section key={section.title} className="py-2">
              <h5 className="t-label border-b border-solid border-hairline-strong pb-1 text-muted">
                {section.title}
              </h5>
              <ul className="list-none p-0">
                {section.items.map((item, index) => (
                  <li
                    key={`${item.name}-${index}`}
                    className="border-b border-solid border-hairline py-2 last:border-b-0"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <p className="t-small text-ink">{item.name}</p>
                      <p className="t-data text-ink">
                        {formatMoney(item.price, item.currency ?? menu.currency)}
                      </p>
                    </div>
                    {item.description !== null ? (
                      <p className="t-small mt-1 text-muted">{item.description}</p>
                    ) : null}
                    {item.allergenNotes !== null ? (
                      <p className="t-data-sm mt-1 bg-sunken px-2 py-1 text-ink">
                        Menu allergen note: {item.allergenNotes}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="px-4 pt-4 t-small text-muted">
          No priced menu items were readable on the checked page.
        </p>
      )}

      {menu.notes.length > 0 ? (
        <div className="px-4 pb-2 pt-3">
          <p className="t-label text-muted">Page note</p>
          <ul className="mt-1 flex list-none flex-col gap-1 p-0">
            {menu.notes.slice(0, 2).map((note) => (
              <li key={note} className="t-small line-clamp-3 text-muted">
                {note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-solid border-hairline px-4 py-3">
        <LinkButton variant="ghost" size="sm" href={menu.sourceUrl}>
          Open menu source
        </LinkButton>
        <p className="t-data-sm text-muted">Checked {checkedStamp(menu.retrievedAt)}</p>
      </div>
    </article>
  );
}

/** Renders every checked venue card. */
export function VenueEvidenceCards({ evidence }: { evidence: readonly VenueEvidence[] }) {
  if (evidence.length === 0) return null;
  const hotels = evidence.filter((item): item is HotelEvidence => item.kind === "hotel");
  const menus = evidence.filter((item): item is MenuEvidence => item.kind === "menu");
  return (
    <section aria-labelledby="venue-evidence-heading" className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-solid border-ink pt-3">
        <h3 id="venue-evidence-heading" className="t-title text-ink">
          Checked venue facts
        </h3>
        <p className="t-data-sm text-muted">
          {hotels.length} {hotels.length === 1 ? "room quote" : "room quotes"} ·{" "}
          {menus.length} {menus.length === 1 ? "menu" : "menus"} ·{" "}
          {menus.reduce((total, menu) => total + menu.items.length, 0)} menu items
        </p>
      </div>
      <div className="mt-4 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {hotels.map((hotel) => (
          <HotelCard key={`${hotel.placeId ?? hotel.placeName}-hotel`} hotel={hotel} />
        ))}
        {menus.map((menu) => (
          <MenuCard key={`${menu.placeId ?? menu.placeName}-menu`} menu={menu} />
        ))}
      </div>
      <p className="t-small measure mt-5 text-muted">
        Menu items, prices, and room rates are checked snapshots, not booking guarantees.
        Confirm allergens, cross-contact, hours, and the final rate with the venue before
        booking. The safety envelope and day ceilings do not use these prices.
      </p>
    </section>
  );
}
