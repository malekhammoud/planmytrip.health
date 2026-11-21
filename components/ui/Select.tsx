import { ChevronDown } from "lucide-react";
import type { ReactNode, SelectHTMLAttributes } from "react";

/** Props for {@link Select}. Standard select attributes pass through. */
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Required id that binds the label from Field. */
  id: string;
  /**
   * Optional muted prompt shown while no value is selected. Placeholder styling
   * assumes controlled usage: pass `value` and `onChange`.
   */
  placeholder?: string;
  /** Option elements. */
  children: ReactNode;
}

/**
 * Native select with the Paper and Ink field treatment: transparent, a bottom
 * hairline, and a 16px chevron on the right. The chevron is decorative only.
 */
export function Select({ id, className, placeholder, value, children, ...rest }: SelectProps) {
  const showPlaceholder =
    placeholder !== undefined && (value === "" || value === undefined);
  return (
    <div className="relative w-full">
      <select
        {...rest}
        id={id}
        value={value}
        className={[
          "h-11 w-full max-w-none appearance-none rounded-none border-x-0 border-t-0 border-b border-solid border-hairline-strong bg-transparent py-0 pl-0 pr-6 t-body transition-colors duration-150 disabled:cursor-not-allowed disabled:text-muted",
          showPlaceholder ? "text-muted" : "text-ink",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {placeholder !== undefined ? (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        ) : null}
        {children}
      </select>
      <ChevronDown
        size={16}
        strokeWidth={1.75}
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-muted"
      />
    </div>
  );
}
