/**
 * The completion list, floating at the caret.
 *
 * Rendered in React and positioned like the other floating surfaces rather than
 * through the editor's selection widget: that one only appears for a
 * non-collapsed selection, and a completion list belongs at a caret.
 */
import { useLayoutEffect, useRef, useState } from "react"
import type { CompletionItem } from "@byconvo/core/language"
import { placeCard, type Placement, type Rect } from "@/lib/floating-placement"
import { cn } from "@/lib/utils"

/** Rows visible before the list scrolls. */
const VISIBLE_ROWS = 9

interface CompletionPopupProps {
  anchor: Rect
  items: ReadonlyArray<CompletionItem>
  selected: number
  onSelect: (index: number) => void
  onAccept: (index: number) => void
}

export function CompletionPopup({
  anchor,
  items,
  selected,
  onSelect,
  onAccept,
}: CompletionPopupProps) {
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [placement, setPlacement] = useState<Placement | null>(null)

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
  }, [anchor, items])

  // Keyboard navigation moves the highlight past the visible rows.
  useLayoutEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${selected}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [selected])

  if (items.length === 0) return null

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label="Completions"
      className={cn(
        "fixed z-50 max-w-[32rem] min-w-[18rem] overflow-hidden rounded-md",
        "border border-border bg-popover text-popover-foreground shadow-md",
        placement === null && "invisible"
      )}
      style={{ top: placement?.top ?? 0, left: placement?.left ?? 0 }}
      // The caret must stay where it is; the editor would clear it otherwise.
      onPointerDown={(event) => event.preventDefault()}
    >
      <ul
        ref={listRef}
        className="overflow-y-auto py-1"
        style={{ maxHeight: `${VISIBLE_ROWS * 1.5}rem` }}
      >
        {items.map((item, index) => (
          <li key={`${item.label}:${item.source}:${index}`}>
            <button
              type="button"
              data-index={index}
              role="option"
              aria-selected={index === selected}
              className={cn(
                "flex w-full items-baseline gap-2 px-2 py-1 text-left text-xs",
                index === selected ? "bg-muted" : "hover:bg-muted/60"
              )}
              onPointerEnter={() => onSelect(index)}
              onClick={() => onAccept(index)}
            >
              <span className="w-16 shrink-0 truncate text-[10px] tracking-wide text-muted-foreground uppercase">
                {item.kind}
              </span>
              <span className="min-w-0 flex-1 truncate font-mono">
                {item.label}
              </span>
              {item.source.length > 0 && (
                // The symbol is not in scope; accepting it adds the import.
                <span className="shrink-0 truncate text-[10px] text-muted-foreground">
                  {item.source}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
