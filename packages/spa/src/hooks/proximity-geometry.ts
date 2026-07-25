export type ProximityAxis = "x" | "y" | "xy"

export interface Point {
  x: number
  y: number
}

/** Layout coordinates (`offsetTop`/`offsetLeft`), unaffected by CSS transforms. */
export interface LayoutRect {
  top: number
  height: number
  left: number
  width: number
}

/** Screen coordinates, the space the pointer lives in. */
export interface ViewportRect {
  top: number
  height: number
  left: number
  width: number
}

export interface ContainerGeometry {
  readonly bounds: ViewportRect
  readonly scroll: Point
  readonly border: Point
  readonly layoutToViewportScale: Point
}

export const layoutRectOf = (element: HTMLElement): LayoutRect => ({
  top: element.offsetTop,
  height: element.offsetHeight,
  left: element.offsetLeft,
  width: element.offsetWidth,
})

export const sameLayoutRects = (
  a: ReadonlyArray<LayoutRect | undefined>,
  b: ReadonlyArray<LayoutRect | undefined>
): boolean =>
  a.length === b.length &&
  a.every((rect, index) => {
    const other = b[index]
    if (rect === undefined || other === undefined) return rect === other
    return (
      rect.top === other.top &&
      rect.left === other.left &&
      rect.width === other.width &&
      rect.height === other.height
    )
  })

export const containerGeometryOf = (
  container: HTMLElement
): ContainerGeometry => {
  const bounds = container.getBoundingClientRect()
  return {
    bounds,
    scroll: { x: container.scrollLeft, y: container.scrollTop },
    border: { x: container.clientLeft, y: container.clientTop },
    layoutToViewportScale: {
      x: container.offsetWidth > 0 ? bounds.width / container.offsetWidth : 1,
      y:
        container.offsetHeight > 0 ? bounds.height / container.offsetHeight : 1,
    },
  }
}

export const toViewportRect = (
  rect: LayoutRect,
  { bounds, scroll, border, layoutToViewportScale }: ContainerGeometry
): ViewportRect => ({
  left:
    bounds.left + (border.x + rect.left - scroll.x) * layoutToViewportScale.x,
  top: bounds.top + (border.y + rect.top - scroll.y) * layoutToViewportScale.y,
  width: rect.width * layoutToViewportScale.x,
  height: rect.height * layoutToViewportScale.y,
})

const covers = (
  rect: ViewportRect,
  pointer: Point,
  axis: ProximityAxis
): boolean => {
  const withinX = pointer.x >= rect.left && pointer.x <= rect.left + rect.width
  const withinY = pointer.y >= rect.top && pointer.y <= rect.top + rect.height
  if (axis === "x") return withinX
  if (axis === "y") return withinY
  return withinX && withinY
}

const distanceToCenter = (
  rect: ViewportRect,
  pointer: Point,
  axis: ProximityAxis
): number => {
  const dx = pointer.x - (rect.left + rect.width / 2)
  const dy = pointer.y - (rect.top + rect.height / 2)
  if (axis === "x") return Math.abs(dx)
  if (axis === "y") return Math.abs(dy)
  return Math.hypot(dx, dy)
}

/**
 * The item the pointer is over, or — when it sits in a gap — the one whose
 * center is closest along `axis`.
 */
export const itemIndexAtPointer = (
  pointer: Point,
  rects: ReadonlyArray<ViewportRect | undefined>,
  axis: ProximityAxis
): number | null => {
  let covering: number | null = null
  let nearest: number | null = null
  let nearestDistance = Infinity

  rects.forEach((rect, index) => {
    if (rect === undefined) return
    if (covers(rect, pointer, axis)) covering = index
    const distance = distanceToCenter(rect, pointer, axis)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearest = index
    }
  })

  return covering ?? nearest
}
