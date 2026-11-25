import type { TextareaHTMLAttributes } from "react";

/** Props for {@link TextArea}. */
export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Required id that binds the label or aria-label. */
  id: string;
}

/** Multi-line control on the surface token with the shared focus treatment. */
export function TextArea({ id, className, ...rest }: TextAreaProps) {
  return (
    <textarea
      {...rest}
      id={id}
      className={[
        "min-h-28 w-full resize-none rounded-control border border-solid border-hairline bg-surface px-3 py-2 t-small text-ink transition-colors duration-150 placeholder:text-muted focus:border-accent",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
