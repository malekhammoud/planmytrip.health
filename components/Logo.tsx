/**
 * The PlanMyTrip.health brand mark and lockup.
 *
 * Inputs: an optional size and class for the mark; an optional href for the lockup.
 * Outputs: an inline SVG pin whose pulse is the product's accent, plus the wordmark.
 * Invariants: no raster image, no gradient; the mark inherits ink from its parent and the
 * pulse uses the accent token. The pin makes the travel frame; the pulse makes it health.
 */

/** Props for {@link LogoMark}. */
export interface LogoMarkProps {
  /** Square size in pixels. Defaults to 28. */
  size?: number;
  className?: string;
}

/** The standalone pin-and-pulse mark. */
export function LogoMark({ size = 28, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M16 28.6C16 28.6 25 20.8 25 13.1a9 9 0 1 0-18 0c0 7.7 9 15.5 9 15.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M10.4 13.5h3.1l1.4-2.8 2.1 5.6 1.4-3.1h3.2"
        stroke="var(--accent)"
        strokeWidth="1.9"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

/** Props for {@link LogoLink}. */
export interface LogoLinkProps {
  href?: string;
  className?: string;
}

/**
 * The header lockup. The mark is decorative; the accessible name is the full product name.
 */
export function LogoLink({ href = "/", className }: LogoLinkProps) {
  return (
    <a
      href={href}
      aria-label="PlanMyTrip.health home"
      className={`inline-flex min-h-11 items-center gap-2 whitespace-nowrap ${className ?? ""}`}
    >
      <LogoMark size={26} className="shrink-0 text-ink" />
      <span className="t-wordmark text-ink">
        PlanMyTrip
        <span className="t-data text-accent">.health</span>
      </span>
    </a>
  );
}
