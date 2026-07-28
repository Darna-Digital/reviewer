/**
 * The action bar that floats under a line selection.
 *
 * Positioned by hand rather than through the popover primitive, for the same
 * reason the symbol card is: the anchor is a run of lines inside a virtualised
 * scroller that can be recycled or scrolled away at any moment, so the bar takes
 * a rectangle rather than an element.
 */
import { useLayoutEffect, useRef, useState } from "react"
import { IconMessagePlus, IconPencil } from "@tabler/icons-react"
import { Kbd } from "@/components/ui/kbd"
import { placeCard, type Placement, type Rect } from "@/lib/floating-placement"
import { cn } from "@/lib/utils"
import type {
  CodeAction,
  CodeActionId,
} from "../interfaces/code-actions.interfaces"

const ICONS: Record<CodeActionId, typeof IconPencil> = {
  comment: IconMessagePlus,
  edit: IconPencil,
}

interface SelectionActionBarProps {
  /** Viewport rectangle of the selected lines. */
  anchor: Rect
  /** What the bar is acting on, e.g. "Lines 12–18". */
  summary: string
  actions: ReadonlyArray<CodeAction>
  onRun: (id: CodeActionId) => void
}

export function SelectionActionBar({
  anchor,
  summary,
  actions,
  onRun,
}: SelectionActionBarProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState<Placement | null>(null)

  // Measure before paint so the bar never flashes at the wrong place.
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
  }, [anchor, actions])

  if (actions.length === 0) return null

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label={`Actions for ${summary}`}
      className={cn(
        "fixed z-50 flex items-center gap-1 rounded-md border border-border",
        "bg-popover p-1 text-popover-foreground shadow-md",
        placement === null && "invisible"
      )}
      style={{ top: placement?.top ?? 0, left: placement?.left ?? 0 }}
      // The selection lives in the view; a pointer press here must not clear it.
      onPointerDown={(event) => event.preventDefault()}
    >
      <span className="px-1.5 text-xs text-muted-foreground">{summary}</span>
      {actions.map((action) => {
        const Icon = ICONS[action.id]
        return (
          <button
            key={action.id}
            type="button"
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs hover:bg-muted"
            onClick={() => onRun(action.id)}
          >
            <Icon className="size-3.5" />
            {action.label}
            {action.shortcut.length > 0 && <Kbd>{action.shortcut}</Kbd>}
          </button>
        )
      })}
    </div>
  )
}
