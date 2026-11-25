/**
 * Browser-side destination memory for house advertisements.
 *
 * Inputs: the last destination a traveler built.
 * Outputs: the local-storage key, a recall helper, and a remember helper.
 * Invariants: only the destination label is stored; no condition, account id, or
 * coordinate pair. Storage failures are ignored so private browsing cannot break a page.
 */

import { safeDestination } from "./campaign";

/** The local-storage key used only by house advertisements. */
export const AD_DESTINATION_KEY = "planmytrip.adDestination";

/** Fired after a destination is remembered so mounted house ads can refresh. */
export const AD_DESTINATION_EVENT = "planmytrip:ad-destination";

/** Returns the remembered destination, or null when absent or unusable. */
export function readAdDestination(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return safeDestination(window.localStorage.getItem(AD_DESTINATION_KEY));
  } catch {
    return null;
  }
}

/** Remembers the destination for future house ads. Best-effort only. */
export function rememberAdDestination(value: string): void {
  const clean = safeDestination(value);
  if (clean === null || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AD_DESTINATION_KEY, clean);
    window.dispatchEvent(new Event(AD_DESTINATION_EVENT));
  } catch {
    // A blocked storage partition is fine. The ad falls back to the time zone.
  }
}
