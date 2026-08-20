/**
 * Which way a diff is laid out — the choice, and the width that can overrule it.
 *
 * Side-by-side is the better read when there is room for it and the worse one
 * when there is not: two columns in half a pane means every line wraps or
 * scrolls sideways, and a review turns into horizontal scrolling. So the
 * preference is what the reader asked for, not a promise about what they get.
 * Below the width where two columns can hold a line of code, the pane lays the
 * diff out inline and says so.
 *
 * The number: a diff column is legible to about 88 characters, roughly 8px each
 * at the pane's font size, and each side also carries a line-number gutter and
 * the pane a scrollbar. Two of those wants ~1000px; below that the split view
 * is already costing more than it gives, so that is where it hands over.
 */
import type { DiffStyle } from "@/lib/ui-prefs";

export const MIN_SPLIT_WIDTH = 1000;

/**
 * `null` width means "not measured yet" — the first frame, before the pane has
 * been laid out. It resolves to the preference: a pane that opened unified and
 * jumped to split once measured reads worse than one that starts as asked and
 * narrows if it must.
 */
export function resolveDiffStyle(
  preferred: DiffStyle,
  width: number | null
): DiffStyle {
  if (preferred !== "split") return preferred;
  if (width === null || width <= 0) return "split";
  return width < MIN_SPLIT_WIDTH ? "unified" : "split";
}

/** Whether the layout, rather than the reader, is what made it unified. */
export function isNarrowedToUnified(
  preferred: DiffStyle,
  width: number | null
): boolean {
  return (
    preferred === "split" && resolveDiffStyle(preferred, width) !== "split"
  );
}
