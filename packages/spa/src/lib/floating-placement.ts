/**
 * Where to put a panel that floats next to something in a scrolling view — a
 * hover card on a token, an action bar under a selection.
 *
 * The anchor sits anywhere, including hard against the bottom or the right
 * edge, so the panel has to flip and clamp. Keeping that as arithmetic over
 * plain rectangles means the awkward cases can be tested without a browser, and
 * the component just applies the result.
 */

export interface Rect {
  readonly top: number
  readonly bottom: number
  readonly left: number
}

export interface Size {
  readonly width: number
  readonly height: number
}

export interface Placement {
  readonly top: number
  readonly left: number
  /** Which side of the token the card ended up on. */
  readonly side: "above" | "below"
}

/** Space between the token and the card. */
const GAP = 6
/** Space kept between the card and the edge of the viewport. */
const MARGIN = 8

export const placeCard = (
  anchor: Rect,
  card: Size,
  viewport: Size
): Placement => {
  const below = anchor.bottom + GAP
  const above = anchor.top - GAP - card.height

  // Prefer below, as an editor tooltip does, and flip up only when the card
  // would not fit and there is genuinely more room above.
  const fitsBelow = below + card.height + MARGIN <= viewport.height
  const fitsAbove = above >= MARGIN
  const side: Placement["side"] = fitsBelow || !fitsAbove ? "below" : "above"

  const maxTop = Math.max(MARGIN, viewport.height - card.height - MARGIN)
  const top =
    side === "below"
      ? Math.min(below, maxTop)
      : Math.max(MARGIN, Math.min(above, maxTop))

  const maxLeft = Math.max(MARGIN, viewport.width - card.width - MARGIN)
  const left = Math.max(MARGIN, Math.min(anchor.left, maxLeft))

  return { top, left, side }
}
