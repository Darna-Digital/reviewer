/**
 * The action bar the editor floats over a text selection.
 *
 * `@pierre/diffs` renders this one itself — it hands back an element and takes
 * over positioning, flipping it above the selection near the bottom of the view
 * and following it as the selection changes. That is worth more than rendering
 * it in React would be, so the bar is built as plain DOM here.
 *
 * Two consequences follow from it living inside the editor's shadow root: the
 * app stylesheet cannot reach it (see {@link SELECTION_ACTION_CSS}, injected
 * through `unsafeCSS`), and it is built imperatively, so it stays deliberately
 * small — anything richer belongs in a React surface the bar opens.
 */
import type { LineRange } from "../interfaces/code-actions.interfaces"

/** Selection as the editor reports it: zero-based lines, half-open at the end. */
export interface EditorSelectionRange {
  readonly start: { readonly line: number; readonly character: number }
  readonly end: { readonly line: number; readonly character: number }
}

/**
 * The one-based, inclusive line range a text selection covers.
 *
 * A selection that ends at column 0 stops at the previous line's newline — it
 * has not reached into the line it points at — so dragging down through a line
 * would otherwise claim one line more than is highlighted.
 */
export const linesOfSelection = (
  selection: EditorSelectionRange
): LineRange => {
  const startLine = Math.min(selection.start.line, selection.end.line)
  const endLine = Math.max(selection.start.line, selection.end.line)
  const endsAtLineStart =
    endLine > startLine &&
    (selection.end.line >= selection.start.line
      ? selection.end.character === 0
      : selection.start.character === 0)
  return {
    start: startLine + 1,
    end: (endsAtLineStart ? endLine - 1 : endLine) + 1,
  }
}

export interface SelectionActionButton {
  readonly label: string
  readonly shortcut: string
  readonly onSelect: () => void
}

/** Build the bar. Returns the element the editor will position. */
export const createSelectionActionElement = (
  summary: string,
  buttons: ReadonlyArray<SelectionActionButton>
): HTMLElement => {
  const bar = document.createElement("div")
  bar.className = "byconvo-selection-actions"
  bar.setAttribute("role", "toolbar")
  bar.setAttribute("aria-label", `Actions for ${summary}`)

  const label = document.createElement("span")
  label.className = "byconvo-selection-actions__summary"
  label.textContent = summary
  bar.append(label)

  for (const button of buttons) {
    const element = document.createElement("button")
    element.type = "button"
    element.className = "byconvo-selection-actions__button"
    element.textContent = button.label
    if (button.shortcut.length > 0) {
      const kbd = document.createElement("kbd")
      kbd.textContent = button.shortcut
      element.append(kbd)
    }
    // The editor clears the selection on a pointer press elsewhere; the bar has
    // to opt out or it would destroy what it is about to act on.
    element.addEventListener("pointerdown", (event) => event.preventDefault())
    element.addEventListener("click", (event) => {
      event.preventDefault()
      button.onSelect()
    })
    bar.append(element)
  }

  return bar
}

/** Styles for the bar, injected into the view's shadow root via `unsafeCSS`. */
export const SELECTION_ACTION_CSS = `
.byconvo-selection-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 6px;
  border: 1px solid var(--border, rgba(128, 128, 128, 0.3));
  background: var(--popover, canvas);
  color: var(--popover-foreground, canvastext);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
  font-family: var(--default-font-family, system-ui, sans-serif);
  font-size: 12px;
  white-space: nowrap;
}
.byconvo-selection-actions__summary {
  padding: 0 6px;
  opacity: 0.6;
}
.byconvo-selection-actions__button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.byconvo-selection-actions__button:hover {
  background: color-mix(in oklab, currentColor 12%, transparent);
}
.byconvo-selection-actions__button kbd {
  padding: 1px 4px;
  border-radius: 3px;
  background: color-mix(in oklab, currentColor 12%, transparent);
  font: inherit;
  font-size: 10px;
  opacity: 0.75;
}
`
