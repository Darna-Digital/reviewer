/**
 * Which of the bottom bar's panels is up.
 *
 * A store rather than the URL: the drawer is something you glance into and
 * shut, not somewhere the window has gone — putting it in the search would make
 * the back button undo a glance, and would carry it to a tab that was minted
 * while it happened to be open. It is not persisted for the same reason.
 *
 * The same tiny `useSyncExternalStore` shape the rest of the app's ephemeral
 * view state uses (see `ui-prefs`), so a component subscribes without a
 * provider having to be threaded through the shell.
 */
import { useSyncExternalStore } from "react";
import type { CollabPanel } from "../interfaces/collab.interfaces";
import { nextPanel } from "../functions/collab-layout.functions";

let open: CollabPanel | null = null;
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

const set = (panel: CollabPanel | null) => {
  if (panel === open) return;
  open = panel;
  emit();
};

/** Press a shortcut: opens it, swaps to it, or shuts the drawer. */
export const pressCollabShortcut = (panel: CollabPanel): void => {
  set(nextPanel(open, panel));
};

export const closeCollabDrawer = (): void => set(null);

export function useCollabDrawer(): CollabPanel | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => open,
    () => open
  );
}
