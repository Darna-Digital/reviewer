/**
 * Which line a comment on a selection belongs to.
 *
 * A review comment is anchored to one line — that is the shape of the model,
 * and of GitHub's, which these are synced to. So a selection spanning several
 * lines has to pick one, and the choice everyone has been taught is the last
 * line it covers: the thread renders under the end of the passage rather than
 * above its start, which is where the eye already is when the selection is let
 * go.
 *
 * The other half is a rule the gutter has always applied: a selection ending at
 * column zero stops short of that line. Dragging down to the start of the next
 * line reads as "everything above it", not as "and this one too".
 */

/** The two ends of a selection, zero-based, as the editor reports them. */
export interface SelectionSpan {
  readonly start: { readonly line: number; readonly character: number };
  readonly end: { readonly line: number; readonly character: number };
}

/**
 * The one-based line a comment on `span` is filed against, or null when the
 * selection is collapsed — a caret is not a passage, and has nothing to say.
 */
export function commentLineFor(span: SelectionSpan): number | null {
  const [from, to] =
    span.start.line < span.end.line ||
    (span.start.line === span.end.line &&
      span.start.character <= span.end.character)
      ? [span.start, span.end]
      : [span.end, span.start];

  if (from.line === to.line && from.character === to.character) return null;

  const last =
    to.character === 0 && to.line > from.line ? to.line - 1 : to.line;
  return last + 1;
}

/** A one-line summary of what was selected, for the composer's placeholder. */
export function selectionSummary(text: string, max = 60): string {
  const flat = text.trim().replace(/\s+/gu, " ");
  if (flat.length === 0) return "";
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}
