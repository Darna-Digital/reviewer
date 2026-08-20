/**
 * Whether the diff pane is currently laying a diff out inline because it is
 * too narrow for two columns — see `resolveDiffStyle`.
 *
 * It is a store rather than a prop because the two ends are nowhere near each
 * other in the tree: the pane is the only thing that can measure itself, and
 * the toggle that would otherwise claim the diff is side-by-side lives up in
 * the window's header. Transient by design — it is a fact about the window's
 * shape right now, not a preference, so it is never persisted.
 */
import { useSyncExternalStore } from "react";

let narrowed = false;
const listeners = new Set<() => void>();

export function setDiffNarrowed(next: boolean) {
  if (next === narrowed) return;
  narrowed = next;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const read = () => narrowed;

/** True while the pane is too narrow to honour a side-by-side preference. */
export function useDiffNarrowed(): boolean {
  return useSyncExternalStore(subscribe, read, read);
}
