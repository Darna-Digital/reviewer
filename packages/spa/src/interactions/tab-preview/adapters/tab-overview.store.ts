/**
 * Whether the tab overview is expanded. It is neither navigation nor a
 * preference — it closes with the next thing you pick — so it is held in a tiny
 * store rather than the URL or localStorage, and read from both ends of the
 * frame: the window bar's previews open it, the frame's canvas gives way to it.
 *
 * The drag that resizes it is held here too, for the same reason the panel's
 * height is not: the page being pushed has to drop its slide transition for as
 * long as the handle is moving, and it is nowhere near the handle in the tree.
 */
import { useSyncExternalStore } from "react";

let expanded = false;
let resizing = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function set(next: boolean): void {
  if (next === expanded) return;
  expanded = next;
  emit();
}

export const closeTabOverview = (): void => set(false);
export const toggleTabOverview = (): void => set(!expanded);

export function setOverviewResizing(next: boolean): void {
  if (next === resizing) return;
  resizing = next;
  emit();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useTabOverview = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => expanded,
    () => false
  );

export const useOverviewResizing = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => resizing,
    () => false
  );
