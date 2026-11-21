import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";

/** Visual variants for {@link Button}. */
export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost";

/**
 * Button sizes. `md` and `sm` are the general sizes; `lg` is 48px and exists
 * only for the constraint rail's Deploy action. Do not use `lg` elsewhere.
 */
export type ButtonSize = "sm" | "md" | "lg";

/** Props for {@link Button}, extending the native button attributes. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual treatment. Defaults to `primary`. */
  variant?: ButtonVariant;
  /** Height and horizontal padding. Defaults to `md`. */
  size?: ButtonSize;
  /** Optional 16px icon rendered before the label and hidden from assistive technology. */
  leadingIcon?: LucideIcon;
  /** Keeps the label visible beside a rotating arc and blocks activation. */
  loading?: boolean;
  /** Stretches the button to the width of its container. */
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-ink text-paper hover:bg-ink-hover",
  accent: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "border border-solid border-hairline-strong bg-transparent text-ink hover:bg-sunken",
  ghost: "bg-transparent text-accent hover:underline",
};

const HEIGHT_CLASSES: Record<ButtonSize, string> = {
  sm: "min-h-9",
  md: "min-h-11",
  lg: "min-h-12",
};

/**
 * Primary action control. Renders a native button with the Paper and Ink
 * button type, token colors, and a 6px control radius.
 */
export function Button({
  variant = "primary",
  size = "md",
  leadingIcon: LeadingIcon,
  loading = false,
  fullWidth = false,
  disabled = false,
  type = "button",
  className,
  children,
  ...rest
}: ButtonProps) {
  const horizontalPadding = variant === "ghost" ? "" : size === "sm" ? "px-4" : "px-5";
  const classes = [
    "inline-flex items-center justify-center gap-2 rounded-control t-button transition-colors duration-150 disabled:cursor-not-allowed",
    HEIGHT_CLASSES[size],
    horizontalPadding,
    VARIANT_CLASSES[variant],
    disabled ? "opacity-45" : "",
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-disabled={disabled || loading || undefined}
      aria-busy={loading || undefined}
      className={classes}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-solid border-current border-t-transparent"
        />
      ) : LeadingIcon ? (
        <LeadingIcon size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
      ) : null}
      <span>{children}</span>
    </button>
  );
}
