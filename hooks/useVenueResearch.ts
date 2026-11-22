/**
 * Browser source for the TinyFish venue-research deck.
 *
 * Inputs: the finished plan, trip dates, party size, and enabled flag.
 * Outputs: VenueResearchState, flattened evidence, and retry().
 * Invariants: one stream per plan/date/party key; mock plans never call TinyFish; frames
 * from an aborted or superseded request are ignored; a closed stream without venue_done
 * becomes a calm error; nothing is logged.
 */

"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { applyVenueFrame } from "@/hooks/venueFrames";
import { createSseParser } from "@/lib/sse";
import type { AgentTripPlan } from "@/lib/agent/agentTypes";
import type { VenueCandidate, VenueEvidence } from "@/lib/venue/types";
import {
  createVenueState,
  venueEvidence,
  venueReducer,
  type VenueResearchState,
} from "@/lib/venue/venueState";

/** Result of {@link useVenueResearch}. */
export interface UseVenueResearchResult {
  state: VenueResearchState;
  evidence: readonly VenueEvidence[];
  retry: () => void;
}

/** Props for {@link useVenueResearch}. */
export interface UseVenueResearchInput {
  plan: AgentTripPlan | null;
  destination: string;
  checkIn: string;
  days: number;
  travelers: number;
  enabled: boolean;
}

const STREAM_FAILED =
  "The venue research stream ended before every page was checked. The plan is unchanged.";

function candidatesFrom(plan: AgentTripPlan): VenueCandidate[] {
  return plan.places
    .filter((place) => place.category === "stay" || place.category === "eat")
    .slice(0, 8)
    .map((place): VenueCandidate => ({
      id: place.id,
      name: place.name,
      category: place.category === "stay" ? "stay" : "eat",
      sourceUrl: place.sourceUrl ?? "",
      menuUrl: place.menuUrl ?? null,
      bookingUrl: place.bookingUrl ?? null,
    }))
    .filter(
      (place) =>
        place.sourceUrl.length > 0 ||
        (place.menuUrl !== null && place.menuUrl !== undefined) ||
        (place.bookingUrl !== null && place.bookingUrl !== undefined),
    );
}

/** Streams live venue evidence for the selected places. */
export function useVenueResearch({
  plan,
  destination,
  checkIn,
  days,
  travelers,
  enabled,
}: UseVenueResearchInput): UseVenueResearchResult {
  const [state, dispatch] = useReducer(venueReducer, createVenueState());
  const [nonce, setNonce] = useState(0);
  const candidates = useMemo(() => (plan === null ? [] : candidatesFrom(plan)), [plan]);

  const retry = useCallback((): void => {
    setNonce((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!enabled || plan === null || plan.mock === true || candidates.length === 0) {
      return;
    }
    const controller = new AbortController();
    let active = true;
    void (async () => {
      dispatch({ type: "run_started" });
      try {
        const response = await fetch("/api/venue-research", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            destination,
            checkIn,
            days,
            travelers,
            places: candidates,
          }),
          signal: controller.signal,
        });
        if (!response.ok || response.body === null) {
          dispatch({ type: "stream_failed", message: STREAM_FAILED });
          return;
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const parser = createSseParser();
        let sawDone = false;
        try {
          for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            for (const frame of parser.push(decoder.decode(chunk.value, { stream: true }))) {
              if (!active) break;
              sawDone = applyVenueFrame(frame, dispatch) || sawDone;
            }
          }
          for (const frame of parser.push(decoder.decode())) {
            if (active) sawDone = applyVenueFrame(frame, dispatch) || sawDone;
          }
          for (const frame of parser.flush()) {
            if (active) sawDone = applyVenueFrame(frame, dispatch) || sawDone;
          }
        } finally {
          reader.releaseLock();
        }
        if (active && !sawDone) {
          dispatch({ type: "stream_failed", message: STREAM_FAILED });
        }
      } catch (cause) {
        if (!active || (cause instanceof DOMException && cause.name === "AbortError")) {
          return;
        }
        dispatch({ type: "stream_failed", message: STREAM_FAILED });
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [candidates, checkIn, days, destination, enabled, nonce, plan, travelers]);

  return { state, evidence: venueEvidence(state), retry };
}
