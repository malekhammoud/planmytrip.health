"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

const SISTER_PRODUCT_URL = "https://ismytripsafe.com";

/**
 * The sister-product link. It stays plain text so the product's identity does not borrow
 * the sister site's photo-led language. The 44px minimum height keeps the tap target
 * comfortable without turning the link into a pill.
 */
function SisterProductLink({ className }: { className: string }) {
  return (
    <a
      href={SISTER_PRODUCT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`t-small min-h-11 items-center text-muted transition-colors duration-150 hover:text-ink hover:underline ${className}`}
    >
      Sister product to IsMyTripSafe.com
    </a>
  );
}

/** Sticky 64px letterhead: wordmark, saved trips, sister product, and the account control. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 h-16 border-b border-hairline bg-paper">
      <div className="page-container flex h-full items-center justify-between gap-6">
        <Link href="/" className="t-wordmark text-ink" aria-label="PlanMyTrip.health home">
          PlanMyTrip
          <span className="t-data text-accent">.health</span>
        </Link>
        <nav aria-label="Account" className="flex items-center gap-4">
          <Link
            href="/trips"
            className="t-small hidden min-h-11 items-center text-muted transition-colors duration-150 hover:text-ink hover:underline sm:inline-flex"
          >
            Saved trips
          </Link>
          <SisterProductLink className="hidden lg:inline-flex" />
          <UserButton />
        </nav>
      </div>
    </header>
  );
}

/** Closing notice. Below 640px the sister product and saved trips stay reachable here. */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-hairline md:mt-24">
      <div className="page-container flex flex-col gap-3 py-6 sm:flex-row sm:items-baseline sm:justify-between">
        <p className="t-small measure text-muted">
          Planning aid only. Not medical advice. Confirm with your clinician and insurer
          before you travel.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/trips"
            className="t-small inline-flex min-h-11 items-center text-muted transition-colors duration-150 hover:text-ink hover:underline sm:hidden"
          >
            Saved trips
          </Link>
          <Link
            href="/model"
            className="t-small inline-flex min-h-11 items-center text-muted transition-colors duration-150 hover:text-ink hover:underline"
          >
            Model card
          </Link>
          <SisterProductLink className="flex sm:hidden" />
        </div>
      </div>
    </footer>
  );
}
