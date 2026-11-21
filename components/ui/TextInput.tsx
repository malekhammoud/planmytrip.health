import type { InputHTMLAttributes } from "react";

/**
 * Props for {@link TextInput}. Standard input attributes pass through, so
 * Field's `aria-describedby` and `aria-invalid` reach the native element.
 */
export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Required id that binds the label from Field. */
  id: string;
}

/**
 * Single-line text control: transparent, ruled by a bottom hairline, and 44px
 * high. The global focus style supplies the accent outline.
 */
export function TextInput({ id, className, ...rest }: TextInputProps) {
  return (
    <input
      {...rest}
      id={id}
      className={[
        "h-11 w-full max-w-none rounded-none border-x-0 border-t-0 border-b border-solid border-hairline-strong bg-transparent px-0 t-body text-ink transition-colors duration-150 placeholder:text-muted disabled:cursor-not-allowed disabled:text-muted",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
