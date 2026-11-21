
/** Props for {@link Skeleton}. */
export interface SkeletonProps {
  /** Width in pixels or a CSS length. Defaults to the full row. */
  width?: number | string;
  /** Height in pixels or a CSS length. Defaults to 16px. */
  height?: number | string;
}

/**
 * Layout placeholder on the sunken token with a 4px frame radius and a slow
 * opacity pulse that stops under reduced motion. Hidden from assistive
 * technology; callers keep their own loading announcements.
 */
export function Skeleton({ width = "100%", height = 16 }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className="skeleton-pulse rounded-frame bg-sunken"
      style={{ width, height }}
    />
  );
}
