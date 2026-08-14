/**
 * Preview windows — the app hosting itself in an `<iframe>` so a tab can be
 * looked at without being opened.
 *
 * The frame is loaded at the app's root with the tab's location in `?preview=`
 * rather than at the location itself: a packaged build resolves its assets
 * relative to the document, so only the root URL finds them. The location is
 * put back into the address before the router boots, so a preview renders the
 * page straight away instead of navigating to it.
 *
 * A preview shares its opener's origin, and so its storage: anything it would
 * write — where the tabs are, when the inbox was last read — is dropped, or
 * looking at a tab would rewrite the window it was opened from.
 */
const PREVIEW_PARAM = "preview";

/** The location a document was asked to preview, if it is a preview at all. */
export function previewedHref(documentUrl: string): string | null {
  return new URL(documentUrl).searchParams.get(PREVIEW_PARAM);
}

/**
 * The URL a preview document is loaded from — and so what everything in it
 * resolved its assets against, before it rewrote its own address.
 */
export function previewRootUrl(documentUrl: string): string {
  return new URL("/", documentUrl).toString();
}

/** The root URL that renders `href` as a preview, resolved against the app. */
export function previewWindowUrl(href: string, documentUrl: string): string {
  const url = new URL(previewRootUrl(documentUrl));
  url.searchParams.set(PREVIEW_PARAM, href);
  return url.toString();
}

function claimPreviewLocation(): string | null {
  if (typeof window === "undefined") return null;
  const href = previewedHref(window.location.href);
  if (href !== null) window.history.replaceState(null, "", href);
  return href;
}

export const isPreviewWindow = claimPreviewLocation() !== null;

/**
 * Nothing in a preview may hold the keyboard. It is a page rendered in a frame
 * parked off the side of a window someone is using, and a composer or a search
 * field autofocusing itself on the way up takes their typing with it — and
 * hands it back on the next capture, which the window reads as having been
 * away and refetches everything on.
 */
if (isPreviewWindow && typeof document !== "undefined") {
  document.addEventListener(
    "focusin",
    (event) => {
      if (event.target instanceof HTMLElement) event.target.blur();
      window.parent.focus();
    },
    true
  );
}

export const previewUrl = (href: string): string =>
  previewWindowUrl(href, window.location.href);
