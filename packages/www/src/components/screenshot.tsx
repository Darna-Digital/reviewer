import { DARK_SCHEME } from "#/hooks/use-prefers-dark";
import { cn } from "#/lib/cn";

/**
 * An app screenshot, captured once in each appearance. The browser picks the
 * `<source>` matching the colour scheme and downloads only that one variant.
 */
export function Screenshot({
  alt,
  className,
  height,
  lazy = false,
  name,
  width,
}: {
  alt: string;
  className?: string;
  height: number;
  lazy?: boolean;
  name: string;
  width: number;
}) {
  return (
    <picture>
      <source media={DARK_SCHEME} srcSet={`/screenshots/${name}-dark.avif`} />
      <img
        alt={alt}
        className={cn("block h-auto w-full", className)}
        decoding="async"
        height={height}
        loading={lazy ? "lazy" : "eager"}
        src={`/screenshots/${name}-light.avif`}
        width={width}
      />
    </picture>
  );
}
