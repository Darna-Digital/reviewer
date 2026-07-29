/**
 * The right-click menu over a symbol. Positioned at the pointer, like every
 * context menu, rather than relative to the token.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { IconLoader2 } from "@tabler/icons-react"
import { placeCard, type Placement, type Rect } from "@/lib/floating-placement"
import { cn } from "@/lib/utils"

export interface SymbolMenuEntry {
  readonly id: string
  readonly label: string
  /** Entries in the `fix` group are separated from the navigation ones. */
  readonly group?: "fix"
  readonly run: () => void
}

interface SymbolMenuProps {
  anchor: Rect
  entries: ReadonlyArray<SymbolMenuEntry>
  /** Quick fixes are still being fetched. */
  loading: boolean
  onClose: () => void
}

export function SymbolMenu({
  anchor,
  entries,
  loading,
  onClose,
}: SymbolMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
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
  }, [anchor, entries, loading])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("scroll", onClose, true)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("scroll", onClose, true)
    }
  }, [onClose])

  const navigation = entries.filter((entry) => entry.group !== "fix")
  const fixes = entries.filter((entry) => entry.group === "fix")

  return (
    <div
      ref={ref}
      role="menu"
      className={cn(
        "fixed z-50 max-w-[26rem] min-w-[15rem] overflow-hidden rounded-md py-1",
        "border border-border bg-popover text-popover-foreground shadow-md",
        placement === null && "invisible"
      )}
      style={{ top: placement?.top ?? 0, left: placement?.left ?? 0 }}
    >
      {navigation.map((entry) => (
        <MenuItem key={entry.id} entry={entry} />
      ))}
      {(fixes.length > 0 || loading) && (
        <div className="my-1 border-t border-border" />
      )}
      {loading && (
        <p className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground">
          <IconLoader2 className="size-3.5 animate-spin" />
          Looking for fixes…
        </p>
      )}
      {fixes.map((entry) => (
        <MenuItem key={entry.id} entry={entry} />
      ))}
    </div>
  )
}

function MenuItem({ entry }: { entry: SymbolMenuEntry }) {
  return (
    <button
      type="button"
      role="menuitem"
      className="block w-full truncate px-3 py-1 text-left text-xs hover:bg-muted"
      onClick={entry.run}
    >
      {entry.label}
    </button>
  )
}
