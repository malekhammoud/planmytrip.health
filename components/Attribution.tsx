"use client";

import { useEffect } from "react";
import { rememberAcquisition } from "@/lib/acquisition";
import { capture } from "@/lib/analytics";

/** Captures the campaign landing and keeps its source for signup and checkout events. */
export function Attribution() {
  useEffect(() => {
    const acquisition = rememberAcquisition(new URLSearchParams(window.location.search));
    if (acquisition === null) return;
    capture("campaign_landing", {
      source: acquisition.source,
      medium: acquisition.medium,
      campaign: acquisition.campaign,
      content: acquisition.content,
      page: window.location.pathname,
    });
  }, []);
  return null;
}
