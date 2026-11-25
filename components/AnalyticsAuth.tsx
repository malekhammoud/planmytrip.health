"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { capture } from "@/lib/analytics";

/**
 * Counts a completed sign-in or a fresh sign-up without sending the Clerk user
 * id, email, name, health profile, or destination. Account-gated pages never
 * produce a pageview; this is the only auth conversion signal.
 */
export function AnalyticsAuth() {
  const { isLoaded, isSignedIn, user } = useUser();
  const fired = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user || fired.current) return;
    fired.current = true;
    try {
      if (window.sessionStorage.getItem("pmt.analytics.auth") === "1") return;
      window.sessionStorage.setItem("pmt.analytics.auth", "1");
    } catch {
      // Storage can be unavailable; a duplicate auth event is harmless.
    }
    let fresh = false;
    try {
      const createdAt = user.createdAt ? new Date(user.createdAt).getTime() : 0;
      fresh = createdAt > 0 && Date.now() - createdAt < 10 * 60_000;
    } catch {
      fresh = false;
    }
    capture(fresh ? "signup_completed" : "auth_signed_in", { page: "/app" });
  }, [isLoaded, isSignedIn, user]);

  return null;
}
