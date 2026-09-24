/**
 * The mark's cells, as `packages/brand` emits them — the same path the macOS
 * app icon is built from. The viewBox is cropped to the mark itself; the
 * padded tile around it only belongs on the icon.
 */
const MARK_PATH =
  "M174.149 124.149H274.149V224.149H174.149ZM274.149 124.149H374.149V224.149H274.149ZM374.149 124.149H474.149V224.149H374.149ZM174.149 224.149H274.149V324.149H174.149ZM374.149 224.149H474.149V324.149H374.149ZM174.149 324.149H274.149V424.149H174.149ZM274.149 324.149H374.149V424.149H274.149ZM174.149 424.149H274.149V524.149H174.149ZM374.149 424.149H474.149V524.149H374.149Z";

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="174.149 124.149 300 400"
      aria-hidden="true"
    >
      <path d={MARK_PATH} fill="currentColor" />
    </svg>
  );
}

/** The app icon itself, in the appearance the macOS build would be showing. */
export function AppIcon({ className }: { className?: string }) {
  return (
    <picture>
      <source
        media="(prefers-color-scheme: dark)"
        srcSet="/reviewer-icon-dark.svg"
      />
      <img
        alt=""
        className={className}
        height={648}
        src="/reviewer-icon-light.svg"
        width={648}
      />
    </picture>
  );
}
