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
let picking = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function set(next: boolean): void {
  if (next === expanded && !picking) return;
  expanded = next;
  picking = false;
  emit();
}

export const closeTabOverview = (): void => set(false);
export const toggleTabOverview = (): void => set(!expanded);

/**
 * A tab has been picked and the window is on its way there, with the panel
 * still covering it. Everything the launchpad was doing for its own sake stops
 * here rather than when the panel finally goes: the page being loaded is the
 * only thing worth the main thread now.
 */
export function beginPick(): void {
  if (picking) return;
  picking = true;
  emit();
}

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

/** Open, and not already on its way somewhere — the only time previews run. */
export const useOverviewIdle = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => expanded && !picking,
    () => false
  );
