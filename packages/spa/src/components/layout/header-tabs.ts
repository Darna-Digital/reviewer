/**
 * Where the open-file strip hangs: the header band over the centre pane.
 *
 * The tabs are what the pane *is* — pick one and the pane is that file — which
 * puts them in the same class as the branch picker at the other end of the row
 * rather than in a strip of their own underneath it. A row of chips below the
 * header read as a second header; on the header's own line they read as the
 * end of one sentence, and the line they used to occupy goes to the trail,
 * which is what reports on the file rather than chooses it.
 *
 * The header is mounted by the layout and the tabs are built by the page under
 * it, so they are siblings with no prop between them: the header lends a node,
 * the page portals into it. Held outside React because the two mount in either
 * order and neither may wait for the other.
 */
import { useSyncExternalStore } from "react";

let slot: HTMLElement | null = null;
const listeners = new Set<() => void>();

export const setHeaderTabsSlot = (next: HTMLElement | null): void => {
  if (slot === next) return;
  slot = next;
  for (const listener of listeners) listener();
};

export const useHeaderTabsSlot = (): HTMLElement | null =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => slot,
    () => null
  );
