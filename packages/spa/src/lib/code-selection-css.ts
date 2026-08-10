/**
 * Repaints a comment selection from the ramp styles.css hangs on
 * `diffs-container`, in every view that can host a comment — the diff and the
 * file view both.
 *
 * `@pierre/diffs` mixes the selection blue into whatever the row already is, so
 * an addition's green swung the anchor line off-hue from the neutral-based
 * annotation below it and the two blues stopped looking related. The ramp mixes
 * from the background instead, which holds one hue across gutter, line and
 * annotation. Pierre lands `unsafeCSS` in its shadow root's `unsafe` layer,
 * which outranks the mixes it computes for the same rows in `base`.
 */
export const selectionShadingCSS = `
[data-line][data-selected-line],
[data-no-newline][data-selected-line] {
  --diffs-computed-selected-line-bg: var(--diffs-selection-line-bg);
}
[data-column-number][data-selected-line],
[data-gutter-buffer][data-selected-line] {
  --diffs-computed-selected-line-bg: var(--diffs-selection-gutter-bg);
}
[data-line-annotation][data-selected-line],
[data-gutter-buffer="annotation"][data-selected-line] {
  --diffs-computed-selected-line-bg: var(--diffs-selection-annotation-bg);
}`;
