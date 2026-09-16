/**
 * The gutter's add-a-comment `+`, in the file view's comment mode.
 *
 * `@pierre/diffs` hangs the button off the right edge of the number column with
 * `margin-right: calc(-1lh + 1ch)`, which leaves a third of it sitting on top
 * of the numbers. Sliding it out by a further character and a half clears the
 * column entirely: the button stands in the channel before the code rather than
 * over the number — and, more to the point, off the fold chevron.
 *
 * That chevron is the floor on how far left the button may sit. `fold-paint`
 * pins it to the same column's right edge with a width of 1.1ch, and the button
 * carries a `:before` that bleeds its hit area 4px past its own left edge — so
 * anything short of `-1lh - 4px` puts an invisible target over the right half of
 * the chevron and folding stops answering clicks. The `1ch` spent here leaves
 * the whole chevron, and a little air, to itself.
 *
 * Pierre lands `unsafeCSS` in its shadow root's `unsafe` layer, which outranks
 * the `base` rule this replaces.
 */
export const commentGutterCSS = `
[data-utility-button] {
  margin-right: calc(-1lh - 1ch);
}`;
