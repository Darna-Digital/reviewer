/**
 * `code-actions` feature — the action bar that appears under a line selection.
 *
 * It replaces the `+` that used to hang in the gutter of every line: an
 * always-visible control for something you only want once you have decided
 * *which code* you mean. Editing needs no action at all any more, because the
 * view is always editable.
 *
 * A text selection is reduced to the lines it covers, because that is the grain
 * the rest of byconvo works in — review comments anchor to a line — so an
 * action always knows exactly what it applies to.
 */

/** A selected run of lines, one-based and inclusive at both ends. */
export interface LineRange {
  readonly start: number
  readonly end: number
}

/** What a view is able to offer for the current selection. */
export interface CodeActionCapabilities {
  /** Comments can be created here (the file view has a comment handler). */
  readonly comment: boolean
}

export type CodeActionId = "comment"

export interface CodeAction {
  readonly id: CodeActionId
  readonly label: string
  /** Displayed shortcut hint, empty when the action has none. */
  readonly shortcut: string
}

export interface CodeActionsDependencies {
  data: {
    readonly capabilities: CodeActionCapabilities
  }
  sideEffects: {
    /** Start a review comment on `line`. */
    readonly comment: (line: number) => void
  }
}

export interface CodeActionsFunctions {
  /** The actions to show, in order; empty when nothing applies. */
  readonly actions: () => ReadonlyArray<CodeAction>
  /** Run an action against a selection. Returns false when it does not apply. */
  readonly run: (id: CodeActionId, range: LineRange) => boolean
}
