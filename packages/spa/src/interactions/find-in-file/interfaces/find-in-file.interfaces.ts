/**
 * `find-in-file` feature — ⌘F over the file that is open.
 *
 * The viewer and the editor are one component wearing two hats, and find has to
 * read the same in both: the same bar, the same three modifiers, the same
 * highlight under the same words. So none of it comes from the editor. Matches
 * are found over the text (the buffer while it is being edited, the loaded file
 * while it is only being read), and painted onto the rendered code from the
 * outside — which is the only way a read-only view could have had them at all.
 *
 * The rules worth being sure of — what a query matches, which match comes next,
 * what a selection may seed a search box with — are pure and live in
 * `find-in-file.functions`. Everything that touches the DOM lives in
 * `find-marks`, behind functions that take the node to work on.
 */

/** The match modifiers, the same three the content search offers. */
export interface FindOptions {
  readonly caseSensitive: boolean;
  readonly wholeWord: boolean;
  readonly regex: boolean;
}

/** One hit, as a slice of one line: line numbers are one-based, columns are not. */
export interface FindMatch {
  readonly line: number;
  readonly start: number;
  readonly end: number;
}

/** A place in the text, as the editor reports one: both halves zero-based. */
export interface TextPosition {
  readonly line: number;
  readonly character: number;
}

/**
 * Where the reader already is, so a fresh query lands on the match in front of
 * them rather than at the top of the file. The caret when there is one, the
 * first line still on screen when there is not.
 */
export interface FindAnchor {
  /** One-based, to match `FindMatch`. */
  readonly line: number;
  readonly character: number;
}

export type FindDirection = "next" | "previous";
