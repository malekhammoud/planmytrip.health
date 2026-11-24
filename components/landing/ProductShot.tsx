/**
 * A real capture of the product, framed as a figure.
 *
 * Inputs: a public screenshot, its intrinsic size, alt text, and an optional caption.
 * Outputs: a responsive `next/image` inside a hairline frame.
 * Invariants: this is the only component allowed to render a raster image. The assets are
 * real captures of PlanMyTrip.health with sample data, never stock photography, illustration,
 * or a fabricated UI. Every image keeps its intrinsic aspect ratio.
 */

import Image from "next/image";
import type { ReactNode } from "react";

/** Props for {@link ProductShot}. */
export interface ProductShotProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  sizes?: string;
  className?: string;
  imageClassName?: string;
  caption?: ReactNode;
}

/** One framed product capture with an optional caption. */
export function ProductShot({
  src,
  alt,
  width,
  height,
  priority = false,
  sizes = "(min-width: 1024px) 50vw, 100vw",
  className,
  imageClassName,
  caption,
}: ProductShotProps) {
  return (
    <figure className={className}>
      <div className="overflow-hidden rounded-frame border border-solid border-hairline-strong bg-paper">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          sizes={sizes}
          className={`h-auto w-full ${imageClassName ?? ""}`}
        />
      </div>
      {caption === undefined ? null : (
        <figcaption className="t-data-sm mt-3 text-muted">{caption}</figcaption>
      )}
    </figure>
  );
}
