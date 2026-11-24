"use client";

import "./globals.css";
import { useEffect } from "react";
import { reportClientError } from "@/lib/ops/client";

/** Last-resort boundary when the root layout itself fails. */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    reportClientError(error, "global.error");
  }, [error]);
  const retry = unstable_retry ?? (() => window.location.reload());
  return (
    <html lang="en">
      <body>
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem 1.25rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
            background: "#f7f5f0",
            color: "#17212b",
          }}
        >
          <p style={{ letterSpacing: "0.18em", textTransform: "uppercase", fontSize: "0.7rem", color: "#66727f" }}>
            PlanMyTrip.health
          </p>
          <h1 style={{ margin: "0.8rem 0 0", fontSize: "1.6rem" }}>Something went wrong</h1>
          <p style={{ maxWidth: "28rem", lineHeight: 1.65, color: "#66727f" }}>
            The planner hit an unrecoverable error. Nothing was submitted.
          </p>
          <button
            onClick={() => retry()}
            style={{ marginTop: 18, borderRadius: 8, border: "1px solid #d8d3c8", padding: "8px 14px", background: "#17212b", color: "#f7f5f0", cursor: "pointer" }}
          >
            Try again
          </button>
          <a href="/" style={{ marginTop: 14, color: "#2f6f5e" }}>Return to the planner</a>
          {error.digest ? <p style={{ marginTop: 16, fontSize: 12, color: "#66727f" }}>Reference {error.digest}</p> : null}
        </main>
      </body>
    </html>
  );
}
