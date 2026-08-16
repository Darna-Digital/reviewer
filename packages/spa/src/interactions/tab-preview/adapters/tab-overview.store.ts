/**
 * Whether the launchpad is expanded. It is neither navigation nor a preference
 * — it closes with the next thing you pick — so it is held in a tiny store
 * rather than the URL or localStorage, and read from both ends of the frame:
 * the handle under the bar opens it, the frame's canvas gives way to it.
 *
 * The drag that resizes it is held here too, for the same reason the panel's
 * height is not: the page being pushed has to drop its slide transition for as
 * long as the handle is moving, and it is nowhere near the handle in the tree.
 */
import { useSyncExternalStore } from "react";
import { OVERVIEW_TRANSITION_MS } from "../functions/tab-preview.functions";

let expanded = false;
let resizing = false;
let picking = false;
let settling = false;
let landing = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function set(next: boolean): void {
  if (next === expanded && !picking) return;
  expanded = next;
  picking = false;
  // The panel is on its way somewhere for the length of its slide, and for that
  // length everything the launchpad does for its own sake can wait.
  settling = true;
  window.clearTimeout(landing);
  landing = window.setTimeout(() => {
    settling = false;
    emit();
  }, OVERVIEW_TRANSITION_MS);
  emit();
}

export const closeTabOverview = (): void => set(false);
export const toggleTabOverview = (): void => set(!expanded);

/**
 * Whether the panel is open right now, for handlers that run outside React's
 * render cycle — a drag reads the value it was given when the pointer went
 * down, which is already wrong by the time the drag has closed the panel.
 */
export const isTabOverviewOpen = (): boolean => expanded;

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

/**
 * Whether a drag is what is sizing the panel, for the same handlers — a panel
 * being pulled open by the pointer is not one to be sized to its own rows.
 */
export const isOverviewResizing = (): boolean => resizing;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * Settles once the panel is standing still.
 *
 * Work that is worth doing but not worth doing *now* waits on this rather than
 * being torn down and started again by the slide: a picture half taken is worth
 * finishing, and the frame the mill has a page up in is worth keeping.
 */
export function whenOverviewStill(): Promise<void> {
  if (!settling) return Promise.resolve();
  return new Promise((resolve) => {
    const stop = subscribe(() => {
      if (settling) return;
      stop();
      resolve();
    });
  });
}

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

/** On its way somewhere — the one time the mill stands aside. */
export const useOverviewPicking = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => picking,
    () => false
  );
