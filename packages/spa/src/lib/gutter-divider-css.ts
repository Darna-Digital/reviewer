/**
 * The rule between the line numbers and the code, in the file view.
 *
 * `@pierre/diffs` paints that seam as a gap rather than a line: every gutter
 * cell carries `border-right: var(--diffs-gap-style, 2px solid var(--diffs-bg))`,
 * which reads as two pixels of page between the two columns. That is enough
 * while the gutter holds numbers and nothing else. This view hangs two controls
 * off the same edge — the fold chevron and the add-a-comment `+` — and with no
 * line between them they sit in one undivided channel and read as a single
 * smudged control.
 *
 * What this file does is clear the lane and reserve the pixel. The number
 * column's right padding is widened to `1lh`, the chevron's own box, so the
 * chevron has somewhere to stand that is neither on the last digit nor across
 * the seam; the gap narrows to a single transparent pixel at the far side of
 * it, which `gutter-rule` paints. The line itself is drawn out in the pane
 * because the rows cannot carry it the whole height of the editor — see the
 * note there.
 *
 * Transparent rather than absent so the column keeps that pixel: the overlay is
 * placed by measuring this column, and a border it can cover exactly is what
 * keeps the two in step.
 *
 * Scoped to `[data-file]` because a unified diff's gutter carries two number
 * columns and the same variable draws the gap between them, so anything spent
 * here would also be spent between the old number and the new one.
 *
 * Pierre lands `unsafeCSS` in its shadow root's `unsafe` layer, which outranks
 * the `base` rules these replace.
 */
export const gutterDividerCSS = `
[data-file] [data-gutter] {
  --diffs-gap-style: 1px solid transparent;
}
[data-file] [data-column-number] {
  padding-right: 1lh;
}`;
