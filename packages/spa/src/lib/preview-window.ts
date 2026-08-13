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

/** The root URL that renders `href` as a preview, resolved against the app. */
export function previewWindowUrl(href: string, documentUrl: string): string {
  const url = new URL("/", documentUrl);
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

export const previewUrl = (href: string): string =>
  previewWindowUrl(href, window.location.href);
