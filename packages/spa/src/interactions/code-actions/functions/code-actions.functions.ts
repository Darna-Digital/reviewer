import type { SelectedLineRange } from "@pierre/diffs"
import type {
  CodeAction,
  CodeActionCapabilities,
  CodeActionId,
  CodeActionsDependencies,
  CodeActionsFunctions,
  LineRange,
} from "../interfaces/code-actions.interfaces"

/** Every action the bar knows about, in the order it shows them. */
const CATALOG: ReadonlyArray<CodeAction> = [
  { id: "comment", label: "Comment", shortcut: "C" },
  { id: "edit", label: "Edit", shortcut: "E" },
]

/**
 * A selection normalised to a usable range, or null when there isn't one.
 *
 * Dragging upwards reports `end` before `start`, and a view with nothing
 * selected reports null — both reach this the same way, so the rest of the
 * feature never has to check either case.
 */
export const normalizeRange = (
  selection: SelectedLineRange | null | undefined
): LineRange | null => {
  if (selection === null || selection === undefined) return null
  const { start, end } = selection
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  const low = Math.min(start, end)
  const high = Math.max(start, end)
  if (low < 1) return null
  return { start: low, end: high }
}

export const lineCount = (range: LineRange): number =>
  range.end - range.start + 1

/** What the bar says it is acting on. */
export const selectionSummary = (range: LineRange): string => {
  const count = lineCount(range)
  return count === 1
    ? `Line ${range.start}`
    : `Lines ${range.start}–${range.end}`
}

/** The actions a view can actually offer, in catalog order. */
export const availableActions = (
  capabilities: CodeActionCapabilities
): ReadonlyArray<CodeAction> =>
  CATALOG.filter((action) => capabilities[action.id])

/**
 * The line an action applies to. A comment anchors to the last selected line —
 * the same line the gutter `+` used to anchor to, so existing comments keep
 * lining up — while editing jumps to the first, which is what you were looking
 * at when you selected.
 */
export const targetLine = (id: CodeActionId, range: LineRange): number =>
  id === "comment" ? range.end : range.start

export function createCodeActionsFunctions(
  d: CodeActionsDependencies
): CodeActionsFunctions {
  const actions: CodeActionsFunctions["actions"] = () =>
    availableActions(d.data.capabilities)

  const run: CodeActionsFunctions["run"] = (id, range) => {
    if (!d.data.capabilities[id]) return false
    const line = targetLine(id, range)
    if (id === "comment") d.sideEffects.comment(line)
    else d.sideEffects.edit(line)
    return true
  }

  return { actions, run }
}
