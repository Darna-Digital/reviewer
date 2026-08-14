/**
 * `tab-preview` feature — the launchpad, and the live views in it.
 *
 * The window bar's Launchpad button expands the strip into a grid: every open
 * tab as a card showing its own page, running. A card is a preview window (see
 * `lib/preview-window`) rendering that tab's location, scaled into the box the
 * grid gives it.
 */

/** A place a preview can be taken of: what to load, and what to call it. */
export interface PreviewTarget {
  readonly href: string;
  readonly title: string;
}

/** How much of a preview window's own size a preview is drawn at. */
export type PreviewZoom = number;
