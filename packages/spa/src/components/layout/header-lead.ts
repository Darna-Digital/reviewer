/**
 * The columns the page lays out to the left of itself, so the header can be cut
 * to match them.
 *
 * The seams between a page's columns run the height of the window, and a header
 * drawn straight across the top of them was the one place they stopped: a band
 * of sheet lying over the gaps, with the frame picking up again underneath. So
 * the header is cut where the page is cut. The branch picker stands over the
 * column it names, the open files over the pane they open into, and every seam
 * goes from the window bar to the dock without a break in it.
 *
 * The page owns those widths and, mid-drag, sizes each column straight from the
 * DOM rather than through React (see `usePanelSize`). What is published here is
 * therefore the CSS length to read each by — `var(--panel-sidebar-w)` — so the
 * header tracks a drag for free instead of re-rendering with it. Empty where
 * the page has no columns, and the header is one band across.
 *
 * Held outside React because the header is mounted by the layout and the
 * columns by the page under it: siblings with no prop between them, mounting in
 * either order, neither able to wait for the other. Same arrangement as the
 * tab strip — see `header-tabs`.
 */
import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";

/** Layout effects only exist in the browser; the prerender pass uses the other. */
const usePublishEffect =
  typeof document === "undefined" ? useEffect : useLayoutEffect;

const NONE: ReadonlyArray<string> = [];

let leads: ReadonlyArray<string> = NONE;
const listeners = new Set<() => void>();

const publish = (next: ReadonlyArray<string>): void => {
  leads = next;
  for (const listener of listeners) listener();
};

/**
 * Declare the page's left-hand columns for as long as the page is mounted,
 * outermost first. Before paint, so the header is never drawn across a seam it
 * is about to be cut at.
 *
 * The widths are depended on by their text rather than by the array holding
 * them: a page rebuilds that list on every render, and republishing an
 * unchanged one would wake every subscriber for nothing.
 */
export function useHeaderLead(widths: ReadonlyArray<string>): void {
  const key = widths.join("|");
  usePublishEffect(() => {
    publish(key === "" ? NONE : key.split("|"));
    return () => publish(NONE);
  }, [key]);
}

export const useHeaderLeadWidths = (): ReadonlyArray<string> =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => leads,
    () => NONE
  );
