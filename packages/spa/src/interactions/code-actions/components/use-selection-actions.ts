/**
 * Selection actions for an editable file view.
 *
 * The editor owns the popover: given `enabledSelectionAction`, it calls
 * `renderSelectionAction` for every non-collapsed selection and positions the
 * element over it, flipping and following as the selection moves. That is why
 * this hook configures the editor rather than rendering anything itself.
 *
 * It only appears for a real selection — a bare caret is collapsed, and the
 * editor skips those — so clicking around to read never puts a bar in the way.
 */
import { useEffect, useRef } from "react"
import type { Editor } from "@pierre/diffs/editor"
import {
  availableActions,
  selectionSummary,
  targetLine,
} from "../functions/code-actions.functions"
import {
  createSelectionActionElement,
  linesOfSelection,
  SELECTION_ACTION_CSS,
} from "../functions/selection-action-element"
import type { CodeActionCapabilities } from "../interfaces/code-actions.interfaces"

export interface SelectionActionsOptions {
  readonly editor: Editor<undefined>
  readonly capabilities: CodeActionCapabilities
  /** Start a review comment on `line`. */
  readonly onComment: (line: number) => void
}

export interface SelectionActions {
  /** Append to the view's `unsafeCSS`; the bar renders in its shadow root. */
  readonly unsafeCSS: string
}

export function useSelectionActions({
  editor,
  capabilities,
  onComment,
}: SelectionActionsOptions): SelectionActions {
  // The editor holds `renderSelectionAction` for the life of the view, so the
  // callback reads current values rather than being re-registered on each one.
  const latest = useRef({ capabilities, onComment })
  latest.current = { capabilities, onComment }

  useEffect(() => {
    editor.setOptions({
      enabledSelectionAction: true,
      renderSelectionAction: (context) => {
        const { capabilities: caps, onComment: comment } = latest.current
        const range = linesOfSelection(context.selection)
        const buttons = availableActions(caps).map((action) => ({
          label: action.label,
          shortcut: action.shortcut,
          onSelect: () => {
            // The comment lands on the last selected line, and the draft that
            // opens is what the user acts in next — so the bar gets out of it.
            context.close()
            comment(targetLine(action.id, range))
          },
        }))
        return createSelectionActionElement(selectionSummary(range), buttons)
      },
    })
  }, [editor])

  return { unsafeCSS: SELECTION_ACTION_CSS }
}
