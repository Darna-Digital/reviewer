/**
 * Where the trail hangs when it belongs beside the branch picker rather than
 * under the pane.
 *
 * Above a diff the trail is not a report of where you are — it is what chooses
 * what the diff *is*, which puts it in the same class as the picker two crumbs
 * to its left. Sitting on its own row underneath, it read as a second header
 * saying less; on the same line it reads as the rest of one sentence.
 *
 * The header is mounted by the layout and the trail is built by the page under
 * it, so they are siblings with no prop between them: the header lends a node,
 * the page portals into it. Held outside React because the two mount in either
 * order and neither may wait for the other.
 */
import { useSyncExternalStore } from "react";

let slot: HTMLElement | null = null;
const listeners = new Set<() => void>();

export const setHeaderTrailSlot = (next: HTMLElement | null): void => {
  if (slot === next) return;
  slot = next;
  for (const listener of listeners) listener();
};

export const useHeaderTrailSlot = (): HTMLElement | null =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => slot,
    () => null
  );
