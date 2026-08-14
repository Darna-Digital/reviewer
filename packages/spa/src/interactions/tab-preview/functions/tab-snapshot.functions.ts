/**
 * Turning a running page into a picture of itself.
 *
 * A preview used to be the tab's app, live, one instance per card — a dozen
 * React roots booting into a dozen sockets and their own round of every request
 * the page makes, all so you could glance at a thumbnail. What a glance
 * actually needs is the markup, so that is what is kept: the page is rendered
 * once somewhere off screen, its DOM is serialised, and the card shows that
 * — static HTML with the app's own stylesheet, no scripts, nothing running.
 *
 * The cost moves from "every card, all the time" to "one page at a time, every
 * ten seconds", and reopening the launchpad costs nothing at all.
 */

/** How long a full pass over the tabs waits before starting the next one. */
export const SNAPSHOT_REFRESH_MS = 10_000;

/** How long a page is given to render before its picture is taken. */
export const SNAPSHOT_SETTLE_MS = 700;

/** When to give up on a page that never finished loading and move on. */
export const SNAPSHOT_TIMEOUT_MS = 15_000;

/**
 * The most markup a picture is worth holding. A page that serialises past this
 * is one whose thumbnail would cost more memory than the tab it stands for —
 * a diff of a few thousand lines — so it keeps its title card instead.
 */
export const SNAPSHOT_MAX_CHARS = 2_000_000;

/** A page as it looked when it was last rendered. */
export interface TabSnapshot {
  readonly html: string;
  /** `performance.now()` at capture, so the loop can tell one pass from the next. */
  readonly at: number;
}

const escapeAttribute = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");

/**
 * Point the serialised page's relative URLs back at the app it came from.
 *
 * The document is shown in a `srcdoc` frame, which has no address of its own
 * and resolves against whatever window it is in — the wrong place for a
 * stylesheet written as `./assets/…`. A preview also rewrites its own address
 * to the page it renders while its assets are already resolved against the
 * root, so the root is what the base has to be.
 */
export function withBase(html: string, baseHref: string): string {
  const base = `<base href="${escapeAttribute(baseHref)}">`;
  const head = /<head(\s[^>]*)?>/i.exec(html);
  return head === null
    ? `${base}${html}`
    : html.replace(head[0], `${head[0]}${base}`);
}

/**
 * The document as markup, or null if it is not worth keeping. The scripts go:
 * a snapshot frame runs none of them, and the app's hydration payload is the
 * single largest thing in the page it would otherwise carry.
 */
export function snapshotOf(
  documentToCapture: Document,
  baseHref: string
): string | null {
  const root = documentToCapture.documentElement;
  if (root === null) return null;
  for (const script of documentToCapture.querySelectorAll("script")) {
    script.remove();
  }
  for (const hint of documentToCapture.querySelectorAll(
    'link[rel="modulepreload"], link[rel="preload"], link[rel="prefetch"]'
  )) {
    hint.remove();
  }
  const html = withBase(root.outerHTML, baseHref);
  return html.length > SNAPSHOT_MAX_CHARS || root.childElementCount === 0
    ? null
    : `<!doctype html>${html}`;
}

/**
 * The order the pictures are taken in: whatever you are looking at first, then
 * round the rest. A pass that starts at the tab you just opened the launchpad
 * on is the one whose first result you are most likely to be waiting for.
 */
export function captureOrder<T>(
  items: ReadonlyArray<T>,
  from: number
): Array<T> {
  if (items.length === 0) return [];
  const start = from < 0 || from >= items.length ? 0 : from;
  return [...items.slice(start), ...items.slice(0, start)];
}
