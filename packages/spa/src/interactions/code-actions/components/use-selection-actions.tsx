/**
 * The selection action bar for a file view, packaged as one hook.
 *
 * A view adopts it by spreading `viewOptions` into its options and rendering
 * `bar`. The view keeps owning its own selection highlight — `@pierre/diffs`
 * paints that itself — so all this holds is the committed range and the
 * rectangle to hang the bar off.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { SelectedLineRange } from "@pierre/diffs"
import { queryInCode } from "@/lib/code-root"
import type { Rect } from "@/lib/floating-placement"
import {
  createCodeActionsFunctions,
  normalizeRange,
  selectionSummary,
} from "../functions/code-actions.functions"
import type {
  CodeActionCapabilities,
  CodeActionId,
  LineRange,
} from "../interfaces/code-actions.interfaces"
import { SelectionActionBar } from "./selection-action-bar"

/**
 * The rectangle spanning the selected lines, or null when none of them are
 * rendered — a selection can be scrolled out of a virtualised view.
 */
export const rectOfLines = (
  container: ParentNode,
  range: LineRange
): Rect | null => {
  const first = queryInCode(container, `[data-line="${range.start}"]`)
  const last = queryInCode(container, `[data-line="${range.end}"]`)
  const anchors = [first, last].filter((element) => element !== null)
  if (anchors.length === 0) return null
  const rects = anchors.map((element) => element.getBoundingClientRect())
  return {
    top: Math.min(...rects.map((rect) => rect.top)),
    bottom: Math.max(...rects.map((rect) => rect.bottom)),
    left: Math.min(...rects.map((rect) => rect.left)),
  }
}

export interface SelectionActionsOptions {
  capabilities: CodeActionCapabilities
  /**
   * Hide the bar and drop the selection — set while something the bar started
   * is on screen. Acting on a selection makes the view write its own selection
   * back (a comment draft highlights its line), which would otherwise bounce
   * straight back through `onLineSelected` and reopen the bar.
   */
  suspended?: boolean
  /** Start a review comment on `line`. */
  onComment: (line: number) => void
  /** Open the editor at `line`. */
  onEdit: (line: number) => void
  /** Resolves the element the rendered lines live under. */
  getContainer: () => ParentNode | null
}

export interface SelectionActions {
  /** Spread into the view's `options`. */
  readonly viewOptions: {
    readonly enableLineSelection: boolean
    readonly onLineSelected: (range: SelectedLineRange | null) => void
  }
  /** Render alongside the view. */
  readonly bar: React.ReactNode
  /** True while a selection is live, so the view can stand down elsewhere. */
  readonly hasSelection: boolean
}

export function useSelectionActions({
  capabilities,
  suspended = false,
  onComment,
  onEdit,
  getContainer,
}: SelectionActionsOptions): SelectionActions {
  const [range, setRange] = useState<LineRange | null>(null)
  const [anchor, setAnchor] = useState<Rect | null>(null)

  const functions = useMemo(
    () =>
      createCodeActionsFunctions({
        data: { capabilities },
        sideEffects: { comment: onComment, edit: onEdit },
      }),
    [capabilities, onComment, onEdit]
  )

  const clear = useCallback(() => {
    setRange(null)
    setAnchor(null)
  }, [])

  // Read inside the selection callback, which the view owns and re-invokes
  // without re-subscribing.
  const suspendedRef = useRef(suspended)
  suspendedRef.current = suspended

  useEffect(() => {
    if (suspended) clear()
  }, [clear, suspended])

  const onLineSelected = useCallback(
    (selection: SelectedLineRange | null) => {
      const next = normalizeRange(selection)
      if (next === null || suspendedRef.current) {
        clear()
        return
      }
      const container = getContainer()
      setRange(next)
      setAnchor(container === null ? null : rectOfLines(container, next))
    },
    [clear, getContainer]
  )

  const run = useCallback(
    (id: CodeActionId) => {
      if (range === null) return
      // Acting on the selection ends it: the comment draft or the editor takes
      // over from here, and a bar left hanging over either would be in the way.
      if (functions.run(id, range)) clear()
    },
    [clear, functions, range]
  )

  const actions = useMemo(() => functions.actions(), [functions])

  // Escape dismisses the bar, a scroll moves the lines out from under it, and
  // each action answers to the shortcut the bar shows next to it.
  useEffect(() => {
    if (range === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clear()
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return
      // Never steal a keystroke meant for a composer or the command menu.
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return
      }
      const match = actions.find(
        (action) =>
          action.shortcut.length > 0 &&
          action.shortcut.toLowerCase() === event.key.toLowerCase()
      )
      if (match === undefined) return
      event.preventDefault()
      run(match.id)
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("scroll", clear, true)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("scroll", clear, true)
    }
  }, [actions, clear, range, run])

  const bar =
    range === null || anchor === null || actions.length === 0 ? null : (
      <SelectionActionBar
        anchor={anchor}
        summary={selectionSummary(range)}
        actions={actions}
        onRun={run}
      />
    )

  return {
    viewOptions: { enableLineSelection: true, onLineSelected },
    bar,
    hasSelection: range !== null,
  }
}
