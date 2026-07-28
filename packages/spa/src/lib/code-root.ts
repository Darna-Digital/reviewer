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
import { DIFFS_TAG_NAME } from "@pierre/diffs"

/**
 * The node a view's own lines live under: its shadow root when it has one, and
 * the element itself otherwise (server rendering, or a future release that
 * drops the shadow DOM).
 */
export const codeRootOf = (container: HTMLElement): ParentNode =>
  container.shadowRoot ?? container

/**
 * Every code root inside `container` — one per view, since a scroller may hold
 * several files. Falls back to `container` itself when it holds no views, so a
 * caller always has something to query.
 */
export const codeRootsWithin = (
  container: ParentNode
): ReadonlyArray<ParentNode> => {
  const roots: Array<ParentNode> = []
  for (const host of container.querySelectorAll(DIFFS_TAG_NAME)) {
    if (host.shadowRoot !== null) roots.push(host.shadowRoot)
  }
  return roots.length > 0 ? roots : [container]
}

/** The first element matching `selector` in any code root under `container`. */
export const queryInCode = (
  container: ParentNode,
  selector: string
): HTMLElement | null => {
  for (const root of codeRootsWithin(container)) {
    const found = root.querySelector(selector)
    if (found instanceof HTMLElement) return found
  }
  return null
}
