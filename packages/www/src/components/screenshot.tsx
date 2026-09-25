import { DARK_SCHEME } from "#/hooks/use-prefers-dark";
import { cn } from "#/lib/cn";

/** Below Tailwind's `sm`, where a whole window is too small to read. */
const PHONE_SCREEN = "(max-width: 639.98px)";

export type ScreenshotCrop = { name: string; width: number; height: number };

/**
 * An app screenshot, captured once in each appearance. The browser picks the
 * `<source>` matching the colour scheme and downloads only that one variant.
 * With a `phone` crop, phones get a closer, taller capture of one corner of
 * the window instead of the whole window shrunk past legibility.
 */
export function Screenshot({
  alt,
  className,
  height,
  lazy = false,
  name,
  phone,
  width,
}: {
  alt: string;
  className?: string;
  height: number;
  lazy?: boolean;
  name: string;
  phone?: ScreenshotCrop;
  width: number;
}) {
  return (
    <picture>
      {phone && (
        <>
          <source
            height={phone.height}
            media={`${PHONE_SCREEN} and ${DARK_SCHEME}`}
            srcSet={`/screenshots/${phone.name}-dark.avif`}
            width={phone.width}
          />
          <source
            height={phone.height}
            media={PHONE_SCREEN}
            srcSet={`/screenshots/${phone.name}-light.avif`}
            width={phone.width}
          />
        </>
      )}
      <source
        height={height}
        media={DARK_SCHEME}
        srcSet={`/screenshots/${name}-dark.avif`}
        width={width}
      />
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
