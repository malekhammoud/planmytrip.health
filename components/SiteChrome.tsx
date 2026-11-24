/* eslint-disable @next/next/no-html-link-for-pages -- account, billing, and saved-trip links deliberately use a full navigation so a stale client router cannot trap the click. */
"use client";

import { UserButton } from "@clerk/nextjs";
import { LogoLink, LogoMark } from "@/components/Logo";
import { LinkButton } from "@/components/ui";

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

/** Props for {@link SiteHeader}. */
export interface SiteHeaderProps {
  /** Shows the public account actions instead of the signed-in navigation. */
  publicView?: boolean;
}

/** Sticky 64px letterhead: brand lockup, saved trips, sister product, and the account control. */
export function SiteHeader({ publicView = false }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-30 h-16 border-b border-hairline bg-paper">
      <div className="page-container flex h-full items-center justify-between gap-4 sm:gap-6">
        <LogoLink />
        {publicView ? (
          <nav aria-label="Account" className="relative z-10 flex items-center gap-2 sm:gap-3">
            <SisterProductLink className="hidden xl:inline-flex" />
            <a
              href="/pricing"
              className="t-small hidden min-h-11 items-center px-1 whitespace-nowrap text-muted transition-colors duration-150 hover:text-ink hover:underline sm:inline-flex"
            >
              Pricing
            </a>
            <a
              href="/sign-in"
              className="t-small hidden min-h-11 items-center px-1 whitespace-nowrap text-muted transition-colors duration-150 hover:text-ink hover:underline sm:inline-flex"
            >
              Sign in
            </a>
            <LinkButton
              variant="primary"
              size="md"
              href="/sign-up"
              external={false}
            >
              Plan a trip
            </LinkButton>
          </nav>
        ) : (
          <nav aria-label="Account" className="relative z-10 flex items-center gap-4">
            <a
              href="/pricing"
              className="t-small hidden min-h-11 items-center px-1 whitespace-nowrap text-muted transition-colors duration-150 hover:text-ink hover:underline sm:inline-flex"
            >
              Plans
            </a>
            <a
              href="/trips"
              className="t-small hidden min-h-11 items-center px-1 whitespace-nowrap text-muted transition-colors duration-150 hover:text-ink hover:underline sm:inline-flex"
            >
              Saved trips
            </a>
            <SisterProductLink className="hidden lg:inline-flex" />
            <UserButton />
          </nav>
        )}
      </div>
    </header>
  );
}

/** Closing notice. Below 640px the sister product and saved trips stay reachable here. */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-hairline md:mt-24">
      <div className="page-container flex flex-col gap-3 py-6 sm:flex-row sm:items-baseline sm:justify-between">
        <div className="flex items-start gap-3">
          <LogoMark size={18} className="mt-0.5 shrink-0 text-ink" />
          <p className="t-small measure text-muted">
            Planning aid only. Not medical advice. Confirm with your clinician and insurer
            before you travel.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <a
            href="/pricing"
            className="t-small inline-flex min-h-11 items-center text-muted transition-colors duration-150 hover:text-ink hover:underline"
          >
            Plans
          </a>
          <a
            href="/trips"
            className="t-small inline-flex min-h-11 items-center text-muted transition-colors duration-150 hover:text-ink hover:underline sm:hidden"
          >
            Saved trips
          </a>
          <a
            href="/model"
            className="t-small inline-flex min-h-11 items-center text-muted transition-colors duration-150 hover:text-ink hover:underline"
          >
            Model card
          </a>
          <SisterProductLink className="flex sm:hidden" />
        </div>
      </div>
    </footer>
  );
}
