/**
 * `tab-preview` feature — the launchpad, and the pictures in it.
 *
 * The handle under the window bar slides a grid out of it: every section of the
 * app as a card showing its own page. A card is not the page running — it is
 * the markup of it, lifted out of one off-screen preview window (see
 * `lib/preview-window`) and hung back up in the card's own shadow root.
 */

/** A place a preview can be taken of: what to load, and what to call it. */
export interface PreviewTarget {
  readonly href: string;
  readonly title: string;
}
