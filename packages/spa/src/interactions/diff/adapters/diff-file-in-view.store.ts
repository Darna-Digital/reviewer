/**
 * Which file the diff pane is scrolled to right now — the one under the
 * reader's eye — and where it stands in the diff's order.
 *
 * A store for the same reason `diff-layout.store` is one: the pane is the only
 * thing that can read its own scroll, and the chrome row that names the file
 * lives up in the window's header, nowhere near it in the tree. The index is
 * carried so the header can tell a step down the diff from a step back up and
 * swing the name in from the matching side. Transient: a fact about the scroll
 * now, never persisted.
 */
import { useSyncExternalStore } from "react";

export interface DiffFileInView {
  readonly path: string;
  readonly index: number;
}

let inView: DiffFileInView | null = null;
const listeners = new Set<() => void>();

export function setDiffFileInView(next: DiffFileInView | null) {
  if (next?.path === inView?.path && next?.index === inView?.index) return;
  inView = next;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const read = () => inView;

/** The file the diff pane has in view, or null while it shows no diff. */
export function useDiffFileInView(): DiffFileInView | null {
  return useSyncExternalStore(subscribe, read, read);
}
