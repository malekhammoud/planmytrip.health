"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/ops/client";

/** Root failure state for PlanMyTrip.health. */
export default function Error({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    reportClientError(error, "app.error");
  }, [error]);
  const retry = unstable_retry ?? reset ?? (() => window.location.reload());
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1.25rem",
        background: "var(--paper, #f7f5f0)",
        color: "var(--ink, #17212b)",
        fontFamily: "var(--font-text, system-ui), sans-serif",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: "0.7rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted, #66727f)" }}>
        PlanMyTrip.health
      </p>
      <h1 style={{ margin: "0.8rem 0 0", fontSize: "1.6rem", letterSpacing: "-0.02em" }}>
        The plan could not open.
      </h1>
      <p style={{ maxWidth: "30rem", lineHeight: 1.65, color: "var(--muted, #66727f)" }}>
        Something failed on our side, not on yours. Nothing you entered was lost.
        Try again, or return to the planner.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={() => retry()}
          style={{ border: "1px solid var(--line, #d8d3c8)", borderRadius: 8, padding: "8px 14px", background: "var(--ink, #17212b)", color: "var(--paper, #f7f5f0)", cursor: "pointer" }}
        >
          Try again
        </button>
        <a href="/" style={{ padding: "8px 14px", color: "var(--accent, #2f6f5e)" }}>
          Return to the planner
        </a>
      </div>
      {error.digest ? <p style={{ marginTop: 18, fontSize: 12, color: "var(--muted, #66727f)" }}>Reference {error.digest}</p> : null}
    </main>
  );
}
