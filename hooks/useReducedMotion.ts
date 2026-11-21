/**
 * Reports the user's reduced-motion preference.
 *
 * Inputs: none. Outputs: true when `prefers-reduced-motion: reduce` matches.
 * Invariants: the server snapshot is false, so no client media query leaks into HTML;
 * the subscription is removed on unmount.
 */

"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getSnapshot(): boolean {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia(QUERY).matches;
}

/** Tracks the reduced-motion media query without reading it during render. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
