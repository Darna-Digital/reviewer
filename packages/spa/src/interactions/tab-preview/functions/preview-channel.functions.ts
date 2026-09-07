/**
 * How the window asks the page in the preview frame to be somewhere else.
 *
 * The mill used to point the frame at each section by writing its `src`, which
 * is a document thrown away and the whole app booted again — its code parsed,
 * its stores built, its queries asked from nothing — a dozen times a pass, for
 * a dozen pictures. The app in there is the same app, and it has a router: what
 * a picture of another section actually needs is a navigation.
 *
 * So the frame is booted once and steered after that, and a pass costs one boot
 * and eleven route changes instead of twelve boots. The preview answers on this
 * channel rather than being reached into from outside — a window poking at
 * another document's internals is a window that breaks when they move — and it
 * answers with the nonce it was given, so a reply that arrives after the mill
 * has moved on is recognisably not the one it is waiting for.
 */
export const PREVIEW_GOTO = "reviewer:preview:goto";
export const PREVIEW_SHOWN = "reviewer:preview:shown";

/** The window asking the preview for a section. */
export interface PreviewGoto {
  readonly type: typeof PREVIEW_GOTO;
  readonly href: string;
  /** Which asking this is, so a late answer can be told from the awaited one. */
  readonly nonce: number;
}

/** The preview saying the page it was asked for is up. */
export interface PreviewShown {
  readonly type: typeof PREVIEW_SHOWN;
  readonly nonce: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const previewGoto = (href: string, nonce: number): PreviewGoto => ({
  type: PREVIEW_GOTO,
  href,
  nonce,
});

export const previewShown = (nonce: number): PreviewShown => ({
  type: PREVIEW_SHOWN,
  nonce,
});

/** The asking `data` carries, if it is one at all. */
export function asPreviewGoto(data: unknown): PreviewGoto | null {
  if (!isRecord(data) || data["type"] !== PREVIEW_GOTO) return null;
  const href = data["href"];
  const nonce = data["nonce"];
  if (typeof href !== "string" || typeof nonce !== "number") return null;
  return previewGoto(href, nonce);
}

/** Whether `data` is the answer to the asking numbered `nonce`. */
export const isPreviewShown = (data: unknown, nonce: number): boolean =>
  isRecord(data) && data["type"] === PREVIEW_SHOWN && data["nonce"] === nonce;
