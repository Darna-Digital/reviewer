/**
 * `formatting` feature — running the project's own formatter over the buffer as
 * it is saved.
 *
 * The orchestration worth isolating is what a save should do when formatting is
 * involved: whether to format at all, and what to do when the formatter fails
 * halfway through a keystroke the user meant as "write this to disk". Saving
 * must not become something that can be lost, so a formatter that errors, or
 * that answers about a buffer the user has since typed past, gives way to the
 * text the editor holds.
 */
import type { TextEdit } from "@byconvo/core/language";

export interface FormatOutcome {
  /** What to save: the formatted text, or the input when nothing changed. */
  readonly contents: string;
  /**
   * The edit that turns the editor's buffer into `contents`, or null when the
   * buffer already matches. Applying an edit rather than replacing the document
   * is what keeps the caret where the user left it and the undo history one
   * step deep.
   */
  readonly edit: TextEdit | null;
}

export interface FormattingDependencies {
  data: {
    /** Whether the user asked for formatting on save. */
    readonly enabled: boolean;
    /** Whether the project has a formatter that can run. */
    readonly available: boolean;
  };
  sideEffects: {
    readonly format: (
      path: string,
      contents: string
    ) => Promise<{ readonly changed: boolean; readonly contents: string }>;
    /** Told what went wrong, when formatting failed but the save went ahead. */
    readonly onFailure: (reason: string) => void;
  };
}

export interface FormattingFunctions {
  /**
   * The buffer as it should be written. Returns the input untouched whenever
   * formatting is off, unavailable, or did not work — a save always writes.
   */
  readonly formatBeforeSave: (
    path: string,
    contents: string
  ) => Promise<FormatOutcome>;
}
