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
 *
 * Whether the slot holds anything is kept here too, said by the page as it
 * fills or empties it. A band that folds away while empty cannot read that
 * off the DOM: `:empty` and `:has()` are re-evaluated by the engine on its own
 * schedule, and WebKit — the macOS shell's island — does not always notice a
 * portal appending into a subtree it is not drawing, leaving the band folded
 * over a strip that is there. See `IslandBar`.
 */
import { useSyncExternalStore } from "react";

let slot: HTMLElement | null = null;
let filled = false;
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const setHeaderTabsSlot = (next: HTMLElement | null): void => {
  if (slot === next) return;
  slot = next;
  notify();
};

export const useHeaderTabsSlot = (): HTMLElement | null =>
  useSyncExternalStore(
    subscribe,
    () => slot,
    () => null
  );

/** The page says whether it is showing a strip in the slot. */
export const setHeaderTabsFilled = (next: boolean): void => {
  if (filled === next) return;
  filled = next;
  notify();
};

export const useHeaderTabsFilled = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => filled,
    () => false
  );
