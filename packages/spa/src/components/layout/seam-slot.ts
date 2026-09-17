/**
 * Where the seams between a page's columns are hung, so a seam can be dragged
 * for its whole length.
 *
 * The header is cut to the page's columns (see `header-lead`): the run of frame
 * between two of them goes from the window bar to the dock, with a band of
 * header either side of it rather than across it. The handle that drags that
 * seam, though, was laid out inside the page, so it started where the page did.
 * The top of the seam — the stretch running past the branch picker and the open
 * files — was a gap you could see but not take hold of, and reaching for the
 * divider up by the tabs did nothing.
 *
 * So the layout lends a box spanning the header and the page together, and the
 * page hangs its column handles in it, placed by the same widths that lay the
 * columns out (see `usePanelSize`). One handle for one seam, the length of it.
 *
 * Held outside React because the box belongs to the layout and the handles to
 * the page under it: siblings with no prop between them, mounting in either
 * order, neither able to wait for the other. Same arrangement as the tab strip
 * — see `header-tabs`.
 */
import { useSyncExternalStore } from "react";

let slot: HTMLElement | null = null;
const listeners = new Set<() => void>();

export const setSeamSlot = (next: HTMLElement | null): void => {
  if (slot === next) return;
  slot = next;
  for (const listener of listeners) listener();
};

export const useSeamSlot = (): HTMLElement | null =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => slot,
    () => null
  );

/**
 * Where a seam lies, measured from the page's left edge: the columns before it,
 * with a seam's width between each pair. A CSS length rather than a number, so
 * it tracks a drag the way the columns themselves do — straight off the custom
 * properties, with no render in between.
 */
export const seamAfter = (...columns: ReadonlyArray<string>): string =>
  `calc(${columns.join(" + var(--frame-seam) + ")})`;
