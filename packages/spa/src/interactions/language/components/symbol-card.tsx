/**
 * The floating card a token opens — hover documentation, a usage list, or a
 * choice of declarations.
 *
 * Built on the app's popover so it dismisses, positions and traps focus the
 * same way every other popover does. The one thing it does differently is where
 * it hangs from: there is no trigger element, because the trigger is a token
 * inside a shadow root that the virtualiser may recycle at any moment. It takes
 * an anchor instead, and `trackAnchor` keeps it with that token as the view
 * scrolls.
 *
 * A hover card must not take focus — the pointer is only passing over — so it
 * opts out of the initial focus move. A card the user asked for by clicking
 * does take focus, which is what makes its list reachable from the keyboard.
 */
import { Popover, PopoverContent } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { VirtualAnchor } from "../functions/anchors"

interface SymbolCardProps {
  /** What the card hangs off, re-measured as the view moves. */
  anchor: Element | VirtualAnchor | (() => Element | VirtualAnchor | null)
  onClose: () => void
  /** A hover card is passive; a clicked one is the user's focus. */
  interactive?: boolean
  onPointerEnter?: () => void
  onPointerLeave?: () => void
  children: React.ReactNode
}

export function SymbolCard({
  anchor,
  onClose,
  interactive = true,
  onPointerEnter,
  onPointerLeave,
  children,
}: SymbolCardProps) {
  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <PopoverContent
        // Scrolling the view dismisses a hover card; scrolling the card itself
        // must not, so the layer's scroll listener can tell them apart.
        data-symbol-card=""
        anchor={anchor}
        side="bottom"
        align="start"
        sideOffset={4}
        collisionPadding={8}
        role="dialog"
        // Hover cards appear under the pointer; taking focus would pull it off
        // whatever the user was typing in.
        initialFocus={interactive}
        finalFocus={false}
        className={cn(
          // `overscroll-contain`: reaching the end of the card must not hand
          // the scroll on to the view behind it, which would dismiss the card.
          "max-h-[min(24rem,60vh)] w-auto max-w-[min(40rem,90vw)] gap-0 overflow-auto overscroll-contain p-2",
          !interactive && "pointer-events-auto"
        )}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}
