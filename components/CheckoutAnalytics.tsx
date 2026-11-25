"use client";

import { useEffect } from "react";
import { capture } from "@/lib/analytics";

/** Captures the Clerk checkout return without putting the query in a pageview. */
export function CheckoutAnalytics() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;
    try {
      if (window.sessionStorage.getItem("pmt.analytics.checkout") === params.toString()) return;
      window.sessionStorage.setItem("pmt.analytics.checkout", params.toString());
    } catch {
      // ignore storage failures
    }
    capture("checkout_success", { page: "/pricing" });
  }, []);
  return null;
}
