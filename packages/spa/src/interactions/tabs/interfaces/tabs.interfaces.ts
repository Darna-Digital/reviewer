/**
 * `tabs` feature — the open-file strip over the centre pane.
 *
 * An IDE's tab strip is not a list of every file ever opened. It has one rule
 * that does most of the work: a file you only *looked* at is previewed in a
 * single reusable slot, and a file you committed to — by editing it, by
 * double-clicking it, or by pinning it — earns a slot of its own. Without that,
 * clicking through a tree of forty files leaves forty tabs behind.
 *
 * Pinning is the other half, and it is WebStorm's: a pinned tab cannot be taken
 * by the preview slot, is skipped by "close others", and sorts ahead of the
 * unpinned ones so it stays reachable when the strip overflows.
 *
 * All of it is decidable from the tab list and a path, so none of it needs a
 * rendered strip to test.
 */

export interface Tab {
  /** Repository-relative path — also the tab's identity. */
  readonly path: string
  /** Pinned tabs survive "close others" and never become the preview slot. */
  readonly pinned: boolean
  /**
   * A tab opened by a single click, holding the slot until the next single
   * click reuses it. At most one tab is ever preview.
   */
  readonly preview: boolean
}

export interface TabsState {
  readonly tabs: ReadonlyArray<Tab>
  /** Path of the tab on screen, or null when the strip is empty. */
  readonly active: string | null
}

/** How a file came to be opened, which decides whether it gets its own slot. */
export type OpenIntent =
  /** A single click in the tree, or a jump from go-to-definition. */
  | "preview"
  /** A double click, an edit, or anything else that says "I am staying". */
  | "permanent"
