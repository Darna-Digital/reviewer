/**
 * Whether the page on screen ends in a trail, told to the dock under it.
 *
 * The two are siblings in the layout with a run of frame between them, and that
 * run belongs above the trail rather than below it: the bar is the page's last
 * line, and the drawer opens directly under it, so what you drag to size the
 * drawer is the gap over the bar and the bar rides on what it opens. The dock
 * cannot see the page to know whether there is a bar to ride on, and the page
 * cannot reach into the dock to move its seam — so the fact passes through here.
 *
 * Held outside React for the same reason as the tab strip and the column seams:
 * publisher and reader are in different subtrees, mount in either order, and
 * neither can wait for the other. See `header-tabs` and `seam-slot`.
 */
import { useEffect, useSyncExternalStore } from "react";

let trailed = false;
const listeners = new Set<() => void>();

const publish = (next: boolean): void => {
  if (trailed === next) return;
  trailed = next;
  for (const listener of listeners) listener();
};

/** Say whether this page wears a trail, and take it back when it leaves. */
export function usePublishPageTrail(present: boolean): void {
  useEffect(() => {
    publish(present);
    return () => publish(false);
  }, [present]);
}

export const usePageTrail = (): boolean =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => trailed,
    () => false
  );
