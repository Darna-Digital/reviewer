/**
 * The floating card a token opens — hover documentation, a usage list, or a
 * choice of declarations.
 *
 * It is positioned by hand rather than through the popover primitive: the
 * anchor is a token inside a virtualised scroller that can be recycled or
 * scrolled away at any moment, so the card takes a rectangle rather than an
 * element and closes itself when the view moves.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { placeCard, type Placement, type Rect } from "@/lib/floating-placement"

interface SymbolCardProps {
  /** Viewport rectangle of the token the card belongs to. */
  anchor: Rect
  onClose: () => void
  /** Hover cards close on their own; clicked ones wait for a dismissal. */
  dismissible?: boolean
  onPointerEnter?: () => void
  onPointerLeave?: () => void
  children: React.ReactNode
}

export function SymbolCard({
  anchor,
  onClose,
  dismissible = true,
  onPointerEnter,
  onPointerLeave,
  children,
}: SymbolCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState<Placement | null>(null)

  // Measure before paint so the card never flashes at the wrong place.
  useLayoutEffect(() => {
    const element = ref.current
    if (element === null) return
    const { width, height } = element.getBoundingClientRect()
    setPlacement(
      placeCard(
        anchor,
        { width, height },
        { width: window.innerWidth, height: window.innerHeight }
      )
    )
  }, [anchor, children])

  useEffect(() => {
    if (!dismissible) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    // Any scroll moves the anchor out from under the card; capture catches the
    // inner scroller as well as the window.
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("scroll", onClose, true)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("scroll", onClose, true)
    }
  }, [dismissible, onClose])

  return (
    <div
      ref={ref}
      role="dialog"
      className={cn(
        "fixed z-50 max-h-[min(24rem,60vh)] max-w-[min(40rem,90vw)] overflow-auto",
        "rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md",
        placement === null && "invisible"
      )}
      style={{ top: placement?.top ?? 0, left: placement?.left ?? 0 }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {children}
    </div>
  )
}
