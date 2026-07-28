/**
 * `code-actions` feature — the action bar that appears under a line selection.
 *
 * It replaces two scattered affordances: the `+` that used to hang in the
 * gutter to start a comment, and the Edit button that lived in the file header.
 * Both were always-visible controls for things you only want once you have
 * decided *which code* you mean, so both now hang off the selection instead.
 *
 * Selection is a line range because that is the grain the rest of byconvo uses
 * — review comments anchor to a line, and `@pierre/diffs` selects by line — so
 * an action always knows exactly what it applies to.
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
  /** The file can be opened in the editor. */
  readonly edit: boolean
}

export type CodeActionId = "comment" | "edit"

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
    /** Open the editor, revealing `line`. */
    readonly edit: (line: number) => void
  }
}

export interface CodeActionsFunctions {
  /** The actions to show, in order; empty when nothing applies. */
  readonly actions: () => ReadonlyArray<CodeAction>
  /** Run an action against a selection. Returns false when it does not apply. */
  readonly run: (id: CodeActionId, range: LineRange) => boolean
}
