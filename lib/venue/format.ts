/**
 * Display helpers for venue evidence and telemetry.
 *
 * Inputs: nullable prices, currency codes, ISO timestamps, URLs, and run clocks.
 * Outputs: bounded human labels for the venue deck and the plan's place rows.
 * Invariants: missing values read "Not stated"; an invalid currency falls back to a plain
 * amount; no locale-dependent value is used in the engine or cache.
 */

import type { VenueEvidence, VenueMenuItem } from "./types";

/** Formats a price or reads "Not stated". */
export function formatMoney(amount: number | null, currency: string | null): string {
  if (amount === null) return "Not stated";
  if (currency === null) return String(amount);
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

/** Formats an evidence timestamp as a short date, or returns the raw value. */
export function checkedDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Formats a checked timestamp as the date and the exact UTC time. */
export function checkedStamp(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return `${checkedDate(value)} · ${date.toISOString().slice(11, 16)} UTC`;
}

/** Returns the host label for a URL, or a fallback. */
export function hostOfUrl(value: string | null, fallback: string): string {
  if (value === null) return fallback;
  try {
    return new URL(value).host.replace(/^www\./, "");
  } catch {
    return fallback;
  }
}

/** Formats whole seconds as an instrument clock: `00:41` or `1:02:03`. */
export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = safe % 60;
  const pad = (value: number): string => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${pad(minutes)}:${pad(rest)}`;
}

/** Whole seconds between two ISO timestamps, or 0 when either is unreadable. */
export function secondsBetween(start: string | null, end: string | null): number {
  if (start === null || end === null) return 0;
  const from = Date.parse(start);
  const to = Date.parse(end);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 0;
  return Math.floor((to - from) / 1000);
}

/** Formats the offset of one timestamp from the run start as `+00:12`. */
export function activityOffset(start: string | null, ts: string | null): string | null {
  if (start === null || ts === null) return null;
  const seconds = secondsBetween(start, ts);
  return `+${formatClock(seconds)}`;
}

/** Prefers a recorded offset, then the live timestamp offset. */
export function displayOffset(
  start: string | null,
  ts: string | null,
  offsetSec: number | null,
): string | null {
  if (offsetSec !== null) return `+${formatClock(offsetSec)}`;
  return activityOffset(start, ts);
}

/** A price range for the checked menu items, or "Price not stated". */
export function menuPriceRange(items: readonly VenueMenuItem[]): string {
  const prices = items
    .map((item) => item.price)
    .filter((price): price is number => price !== null && Number.isFinite(price));
  if (prices.length === 0) return "Price not stated";
  const currency = items.find((item) => item.currency !== null)?.currency ?? null;
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  return low === high
    ? formatMoney(low, currency)
    : `${formatMoney(low, currency)} to ${formatMoney(high, currency)}`;
}

/** One-line checked summary for a plan place row. */
export function evidenceSummary(evidence: VenueEvidence): string {
  if (evidence.kind === "hotel") {
    const nightly =
      evidence.nightlyRate === null
        ? "Rate not stated"
        : `${formatMoney(evidence.nightlyRate, evidence.currency)} a night`;
    return `${nightly} · checked ${checkedStamp(evidence.retrievedAt)}`;
  }
  const count = `${evidence.items.length} ${evidence.items.length === 1 ? "item" : "items"}`;
  return `${count} · ${menuPriceRange(evidence.items)} · checked ${checkedStamp(evidence.retrievedAt)}`;
}

/** Groups menu items by their printed section without reordering them. */
export function menuSections(items: readonly VenueMenuItem[]): { title: string; items: VenueMenuItem[] }[] {
  const sections: { title: string; items: VenueMenuItem[] }[] = [];
  for (const item of items) {
    const title = item.section ?? "Menu";
    const existing = sections.find((section) => section.title === title);
    if (existing === undefined) sections.push({ title, items: [item] });
    else existing.items.push(item);
  }
  return sections;
}
