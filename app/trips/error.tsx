"use client";

import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Button, Callout, LinkButton } from "@/components/ui";

/** Calm failure state for the saved-trip list. */
export default function SavedTripsError({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="page-container flex-1 pt-12 md:pt-20">
        <p className="t-label text-muted">Saved trips</p>
        <h1 className="t-title mt-3">We could not open your saved trips.</h1>
        <div className="mt-6">
          <Callout tone="caution" title="Your trips are still saved">
            <p>We could not load the list right now. Try again in a moment.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={reset}>
                Try again
              </Button>
              <LinkButton href="/" variant="ghost" external={false}>
                Back to the planner
              </LinkButton>
            </div>
          </Callout>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
