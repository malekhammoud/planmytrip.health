import type { AnchorHTMLAttributes } from "react";

/** Visual variants for {@link LinkButton}; mirrors {@link Button}. */
export type LinkButtonVariant = "primary" | "accent" | "secondary" | "ghost";

/** Sizes for {@link LinkButton}. `md` is the 44px tap target. */
export type LinkButtonSize = "sm" | "md";

/** Props for {@link LinkButton}. */
export interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Visual treatment. Defaults to `primary`. */
  variant?: LinkButtonVariant;
  /** Height and horizontal padding. Defaults to `md`. */
  size?: LinkButtonSize;
  /** Stretches the link to the width of its container. */
  fullWidth?: boolean;
  /**
   * Opens in a new tab with `noopener noreferrer`. Defaults to true because every current
   * use is an external handoff such as Google Maps.
   */
  external?: boolean;
}

const VARIANT_CLASSES: Record<LinkButtonVariant, string> = {
  primary: "bg-ink text-paper hover:bg-ink-hover",
  accent: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary:
    "border border-solid border-hairline-strong bg-transparent text-ink hover:bg-sunken",
  ghost: "bg-transparent text-accent hover:underline",
};

const HEIGHT_CLASSES: Record<LinkButtonSize, string> = {
  sm: "min-h-9",
  md: "min-h-11",
};

/**
 * Anchor styled as a Paper and Ink button. It exists so external handoffs keep the button
 * geometry and tap target without nesting an interactive element inside a `<button>`.
 */
export function LinkButton({
  variant = "primary",
  size = "md",
  fullWidth = false,
  external = true,
  className,
  children,
  target,
  rel,
  ...rest
}: LinkButtonProps) {
  const horizontalPadding = variant === "ghost" ? "" : size === "sm" ? "px-4" : "px-5";
  const classes = [
    "inline-flex items-center justify-center gap-2 rounded-control t-button transition-colors duration-150",
    HEIGHT_CLASSES[size],
    horizontalPadding,
    VARIANT_CLASSES[variant],
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <a
      {...rest}
      target={target ?? (external ? "_blank" : undefined)}
      rel={rel ?? (external ? "noopener noreferrer" : undefined)}
      className={classes}
    >
      <span>{children}</span>
    </a>
  );
}
