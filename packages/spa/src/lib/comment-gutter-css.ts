/**
 * The gutter's add-a-comment `+`, in the read-only file view.
 *
 * `@pierre/diffs` hangs the button off the right edge of the number column with
 * `margin-right: calc(-1lh + 1ch)`, which leaves a third of it sitting on top
 * of the numbers. Sliding it out by a further character and a half clears the
 * column entirely: the button stands in the channel before the code rather than
 * over the number.
 *
 * Pierre lands `unsafeCSS` in its shadow root's `unsafe` layer, which outranks
 * the `base` rule this replaces.
 *
 * A comment card has to match the same shove to sit under the button that
 * opened it. The button hangs a character past the number column's padding box,
 * which the column's 2px right border holds back from the code the annotation
 * starts at — so the card is inset by the difference. The variable inherits
 * down the flattened tree into the slot the card is rendered into.
 */
export const commentGutterCSS = `
[data-utility-button] {
  margin-right: calc(-1lh - 1ch);
}

[data-annotation-content] {
  --comment-card-indent: calc(1ch - 2px);
}`;
