/**
 * The checked-page preview shown where the live browser frame ends.
 *
 * Inputs: one validated menu or hotel evidence row and a compact flag.
 * Outputs: the nightly rate and stay terms, or the priced menu sections, with the page
 * handoff.
 * Invariants: only values from the checked page appear; a missing value reads "Not
 * stated"; menu copy stays attributed to the venue page and is never a clinical guarantee.
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
import type { HotelEvidence, MenuEvidence, VenueEvidence } from "@/lib/venue/types";

function DataLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-solid border-hairline py-1 last:border-b-0">
      <dt className="t-data-sm shrink-0 text-muted">{label}</dt>
      <dd className="t-data-sm text-right text-ink">{value}</dd>
    </div>
  );
}

function HotelPreview({ hotel }: { hotel: HotelEvidence }) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div>
          <p className="t-label text-muted">Room rate</p>
          <p className="t-title mt-1 text-ink">
            {formatMoney(hotel.nightlyRate, hotel.currency)}
          </p>
          <p className="t-data-sm mt-1 text-muted">
            {hotel.roomType ?? "Room type not stated"}
          </p>
        </div>
        <p className="t-data-sm text-muted">
          {hotel.checkIn} to {hotel.checkOut} · {hotel.travelers}{" "}
          {hotel.travelers === 1 ? "traveller" : "travellers"}
        </p>
      </div>
      <dl className="flex flex-col">
        <DataLine label="Stay total" value={formatMoney(hotel.total, hotel.currency)} />
        <DataLine
          label="Taxes and fees"
          value={formatMoney(hotel.taxesAndFees, hotel.currency)}
        />
        <DataLine
          label="Booking page"
          value={hostOfUrl(hotel.bookingUrl ?? hotel.sourceUrl, "Not stated")}
        />
        <div className="border-b border-solid border-hairline py-1">
          <dt className="t-data-sm text-muted">Cancellation</dt>
          <dd className="t-small mt-1 text-ink">{hotel.cancellation ?? "Not stated"}</dd>
        </div>
      </dl>
      {hotel.notes.length > 0 ? (
        <ul className="flex list-none flex-col gap-1 p-0">
          {hotel.notes.slice(0, 3).map((note) => (
            <li key={note} className="t-small line-clamp-2 text-muted">
              {note}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center gap-4 pt-1">
        <LinkButton
          variant="secondary"
          size="sm"
          href={hotel.bookingUrl ?? hotel.sourceUrl}
        >
          Open booking page
        </LinkButton>
        <p className="t-data-sm text-muted">
          {hostOfUrl(hotel.sourceUrl, "not stated")} · checked {checkedStamp(hotel.retrievedAt)}
        </p>
      </div>
    </div>
  );
}

function MenuPreview({ menu }: { menu: MenuEvidence }) {
  const sections = menuSections(menu.items);
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div>
          <p className="t-label text-muted">Checked menu</p>
          <p className="t-data mt-1 text-ink">
            {menu.items.length} {menu.items.length === 1 ? "item" : "items"} ·{" "}
            {menuPriceRange(menu.items)}
          </p>
        </div>
        <p className="t-data-sm text-muted">
          {hostOfUrl(menu.sourceUrl, "menu page")}
        </p>
      </div>
      {sections.length > 0 ? (
        <div className="flex flex-col gap-3">
          {sections.map((section) => (
            <section key={section.title}>
              <h4 className="t-label border-b border-solid border-hairline-strong pb-1 text-muted">
                {section.title}
              </h4>
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
                      <p className="t-data-sm mt-1 text-ink">
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
        <p className="t-small text-muted">
          The menu page did not state any items in a readable form.
        </p>
      )}
      {menu.notes.length > 0 ? (
        <div>
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
      <div className="mt-auto flex flex-wrap items-center gap-4 pt-1">
        <LinkButton variant="secondary" size="sm" href={menu.sourceUrl}>
          Open menu source
        </LinkButton>
        <p className="t-data-sm text-muted">
          {hostOfUrl(menu.sourceUrl, "not stated")} · checked {checkedStamp(menu.retrievedAt)}
        </p>
      </div>
    </div>
  );
}

/** Renders the checked page facts inside the browser frame. */
export function VenueEvidencePreview({ evidence }: { evidence: VenueEvidence }) {
  return evidence.kind === "hotel" ? (
    <HotelPreview hotel={evidence} />
  ) : (
    <MenuPreview menu={evidence} />
  );
}
