/**
 * Where the next session will run: here, or in a worktree cut for it.
 *
 * Held outside the composer because the composer unmounts on every navigation,
 * and kept as one value rather than one per session because it only ever
 * describes the session that does not exist yet — an existing one already ran
 * somewhere, and that is a fact, not a choice.
 *
 * Sticky for the life of the window: running each task in its own worktree is a
 * way of working, not a decision to be made again every time. Not persisted —
 * a reloaded window opens on the safe answer.
 */
import { useSyncExternalStore } from "react";

export type RunLocation = "here" | "worktree";

let location: RunLocation = "here";
const listeners = new Set<() => void>();

export const setRunLocation = (next: RunLocation): void => {
  if (location === next) return;
  location = next;
  for (const listener of listeners) listener();
};

export const useRunLocation = (): RunLocation =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => location,
    () => "here"
  );
