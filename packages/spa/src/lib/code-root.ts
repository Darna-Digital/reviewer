/**
 * Reaching the rendered code.
 *
 * `@pierre/diffs` renders every view into a `<diffs-container>` shadow root
 * (open mode). That boundary is easy to forget, because both the container the
 * view hands back from `onPostRender` and the scroll container an app holds a
 * ref to sit *outside* it — a plain `querySelectorAll("[data-line]")` on either
 * one silently returns nothing. Everything that has to touch rendered lines or
 * tokens goes through here instead.
 */
import { DIFFS_TAG_NAME } from "@pierre/diffs";

/**
 * The node a view's own lines live under: its shadow root when it has one, and
 * the element itself otherwise (server rendering, or a future release that
 * drops the shadow DOM).
 */
export const codeRootOf = (container: HTMLElement): ParentNode =>
  container.shadowRoot ?? container;

/**
 * Every code root inside `container` — one per view, since a scroller may hold
 * several files. Falls back to `container` itself when it holds no views, so a
 * caller always has something to query.
 */
export const codeRootsWithin = (
  container: ParentNode
): ReadonlyArray<ParentNode> => {
  const roots: Array<ParentNode> = [];
  for (const host of container.querySelectorAll(DIFFS_TAG_NAME)) {
    if (host.shadowRoot !== null) roots.push(host.shadowRoot);
  }
  return roots.length > 0 ? roots : [container];
};

/** The first element matching `selector` in any code root under `container`. */
export const queryInCode = (
  container: ParentNode,
  selector: string
): HTMLElement | null => {
  for (const root of codeRootsWithin(container)) {
    const found = root.querySelector(selector);
    if (found instanceof HTMLElement) return found;
  }
  return null;
};

/**
 * Viewport rectangle of the caret or selection inside an editable code view.
 *
 * The selection lives in the view's shadow root, which `document.getSelection`
 * does not reach into — Chromium exposes `ShadowRoot.getSelection` for exactly
 * this, and the document selection is the fallback for anywhere that does not.
 */
export const caretRect = (container: ParentNode): DOMRect | null => {
  const roots = codeRootsWithin(container);
  for (const root of roots) {
    const selection =
      "getSelection" in root &&
      typeof (root as { getSelection?: unknown }).getSelection === "function"
        ? (
            root as unknown as { getSelection: () => Selection | null }
          ).getSelection()
        : null;
    const rect = rectOfSelection(selection);
    if (rect !== null) return rect;
  }
  return rectOfSelection(
    typeof document === "undefined" ? null : document.getSelection()
  );
};

const rectOfSelection = (selection: Selection | null): DOMRect | null => {
  if (selection === null || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  // A collapsed caret between two text nodes can measure as all zeros; the
  // client rects of the range still place it.
  if (rect.width > 0 || rect.height > 0) return rect;
  const first = range.getClientRects()[0];
  return first ?? null;
};
