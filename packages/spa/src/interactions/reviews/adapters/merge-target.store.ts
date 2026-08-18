/**
 * The branch the last merge landed on.
 *
 * A worktree remembers where it is aimed, so merging the same one twice needs
 * no second answer. The one it cannot answer is the first merge of a worktree
 * nobody aimed — and there the branch you chose last time is very nearly always
 * the branch you want again, because "which branch am I landing work on" is a
 * fact about the week, not about the task.
 *
 * Held outside React and not persisted: it is a convenience within a sitting,
 * and a reloaded window is entitled to go back to asking the worktree.
 */
import { useSyncExternalStore } from "react";

let target: string | null = null;
const listeners = new Set<() => void>();

export const rememberMergeTarget = (branch: string): void => {
  if (target === branch) return;
  target = branch;
  for (const listener of listeners) listener();
};

export const useLastMergeTarget = (): string | null =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => target,
    () => null
  );
