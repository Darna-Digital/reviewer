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
  for (const root of codeRootsWithin(container)) {
    const rect = rectOfSelection(selectionIn(root));
    if (rect !== null) return rect;
  }
  return rectOfSelection(
    typeof document === "undefined" ? null : document.getSelection()
  );
};

/**
 * The text selected inside a code view, reading the same shadow-root selection
 * `caretRect` measures. Empty when nothing is selected there — a selection in
 * the page around the view is somebody else's to read.
 */
export const selectedTextInCode = (container: ParentNode): string => {
  for (const root of codeRootsWithin(container)) {
    const text = selectedTextIn(root);
    if (text !== "") return text;
  }
  return "";
};

/** Chromium exposes `getSelection` on a shadow root; nothing else has to. */
const selectionIn = (root: ParentNode): Selection | null =>
  "getSelection" in root &&
  typeof (root as { getSelection?: unknown }).getSelection === "function"
    ? (
        root as unknown as { getSelection: () => Selection | null }
      ).getSelection()
    : null;

const selectedTextIn = (root: ParentNode): string => {
  const own = selectionIn(root);
  if (own !== null) return own.toString();
  return root instanceof ShadowRoot ? composedSelectedText(root) : "";
};

/**
 * WebKit — the macOS shell's web view — has no `ShadowRoot.getSelection`, and
 * its document selection reads as empty while the highlight is inside a shadow
 * root. `getComposedRanges` is the standard way back in: told about the root,
 * it hands over the range as it really is, which a live range can then read.
 */
const composedSelectedText = (root: ShadowRoot): string => {
  const selection = document.getSelection();
  if (selection === null || typeof selection.getComposedRanges !== "function")
    return "";
  try {
    const [composed] = selection.getComposedRanges({ shadowRoots: [root] });
    if (composed === undefined || composed.collapsed) return "";
    if (!root.contains(composed.startContainer)) return "";
    const range = document.createRange();
    range.setStart(composed.startContainer, composed.startOffset);
    range.setEnd(composed.endContainer, composed.endOffset);
    return range.toString();
  } catch {
    // An engine still on the draft's `getComposedRanges(...roots)` rejects the
    // options object; it simply has nothing to offer here.
    return "";
  }
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
