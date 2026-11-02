/**
 * Whether the diff pane is showing its "Nothing to review" state.
 *
 * A store for the same reason as `diff-layout.store`: the pane knows it has
 * no files, and the layout toggle that would have nothing to lay out lives up
 * in the window's header. Transient — a fact about what is on screen now.
 */
import { useSyncExternalStore } from "react";

let empty = false;
const listeners = new Set<() => void>();

export function setDiffEmpty(next: boolean) {
  if (next === empty) return;
  empty = next;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const read = () => empty;

/** True while the pane has no changed files to show. */
export function useDiffEmpty(): boolean {
  return useSyncExternalStore(subscribe, read, read);
}
