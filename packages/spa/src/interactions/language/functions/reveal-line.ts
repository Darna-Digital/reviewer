/**
 * Scrolling a line into view inside a virtualised file.
 *
 * Jumping to a definition is the point of go-to-definition, but the target line
 * usually is not in the DOM yet — the view only materialises the lines around
 * the viewport. So the scroll happens in two moves: guess where the line lives
 * from its position in the file, let the virtualiser render that region, then
 * correct against the real element once it exists.
 *
 * The guess is the part worth testing, so it lives here as arithmetic.
 */

/**
 * Where to scroll so that one-based `line` lands in the middle of the viewport,
 * assuming lines are evenly tall. Only ever a first approximation: the caller
 * re-measures once the line renders.
 */
export const estimateScrollTop = (
  line: number,
  totalLines: number,
  scrollHeight: number,
  clientHeight: number
): number => {
  const maxTop = Math.max(0, scrollHeight - clientHeight)
  if (maxTop === 0 || totalLines <= 0) return 0
  const fraction = Math.min(Math.max((line - 1) / totalLines, 0), 1)
  return Math.min(
    Math.max(fraction * scrollHeight - clientHeight / 2, 0),
    maxTop
  )
}

/** Scroll offset that centres an already-rendered element in its container. */
export const scrollTopForElement = (
  elementTop: number,
  elementHeight: number,
  containerTop: number,
  containerScrollTop: number,
  containerHeight: number,
  scrollHeight: number
): number => {
  const offset = elementTop - containerTop + containerScrollTop
  const centred = offset - containerHeight / 2 + elementHeight / 2
  return Math.min(
    Math.max(centred, 0),
    Math.max(0, scrollHeight - containerHeight)
  )
}
