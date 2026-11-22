"use client";

import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Button, Callout } from "@/components/ui";

/** Calm failure state for the saved-trip list. */
export default function SavedTripsError({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="page-container flex-1 pt-12 md:pt-20">
        <p className="t-label text-muted">Saved trips</p>
        <h1 className="t-title mt-3">The trip list could not open.</h1>
        <div className="mt-6">
          <Callout tone="caution" title="Nothing was lost">
            <p>The account store is not reachable right now. Try again.</p>
            <div className="mt-3">
              <Button variant="secondary" onClick={reset}>
                Try again
              </Button>
            </div>
          </Callout>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
