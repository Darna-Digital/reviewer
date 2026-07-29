/**
 * What the editor's floating surfaces hang off.
 *
 * These surfaces belong to things that move: a token inside a virtualised
 * scroller, or the caret. Anchoring them to a rectangle captured when they
 * opened is what stranded the hover card over unrelated code when the view
 * scrolled — and a stranded card sits above the code and swallows clicks meant
 * for it. Anchoring to something that can be re-measured lets the positioner
 * keep the surface with its subject, and notice when the subject is gone.
 */

/** The shape a positioner needs from an anchor. */
export interface VirtualAnchor {
  getBoundingClientRect: () => DOMRect
}

/** A rectangle promoted to something a positioner can measure repeatedly. */
export const rectAnchor = (rect: DOMRect): VirtualAnchor => ({
  getBoundingClientRect: () => rect,
})

/**
 * The point a pointer event happened at, as something a menu can hang off —
 * which is where a context menu belongs, rather than over the token it is
 * about.
 */
export const pointerAnchor = (x: number, y: number): VirtualAnchor => ({
  getBoundingClientRect: () => new DOMRect(x, y, 0, 0),
})

/**
 * Whether an element is still worth anchoring to: attached to a document, and
 * occupying space. A virtualiser recycling a line leaves the element detached,
 * and a detached element measures as all zeros at the origin — which would park
 * the surface in the corner of the screen instead of closing it.
 */
export const isLiveAnchor = (element: Element | null): boolean => {
  if (element === null || !element.isConnected) return false
  const { width, height } = element.getBoundingClientRect()
  return width > 0 || height > 0
}
