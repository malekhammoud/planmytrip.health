/**
 * Fire-and-forget click beacon for house advertisements.
 *
 * Inputs: one validated click event.
 * Outputs: a same-origin POST to /api/ads/click, or nothing when the browser cannot send.
 * Invariants: the beacon carries no identifier and never blocks navigation. The route
 * stores aggregate counts only; the reader can inspect them with `npm run ads:report`.
 */

import type { AdClickEvent } from "./clickEvent";

/** Sends one click event without delaying the link. */
export function trackAdClick(event: AdClickEvent): void {
  if (typeof navigator === "undefined") return;
  const body = JSON.stringify(event);
  if (body.length > 2_000) return;
  try {
    if (typeof navigator.sendBeacon === "function") {
      const sent = navigator.sendBeacon(
        "/api/ads/click",
        new Blob([body], { type: "text/plain;charset=UTF-8" }),
      );
      if (sent) return;
    }
    void fetch("/api/ads/click", {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Advertising measurement must never break a navigation.
  }
}
