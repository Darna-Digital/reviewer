/**
 * What the Find tool window is showing, held outside it.
 *
 * Two reasons it cannot live in the panel. The search is asked for from the
 * code — a right-click in a file, a ⌘-click on a declaration — and the code is
 * the page *under* the layout the dock sits in, so the request has nowhere to
 * travel as a prop. And the panel itself is unmounted whenever the drawer shows
 * another of its four surfaces, so anything it held would be thrown away by a
 * glance at the terminal and rebuilt from nothing on the way back.
 *
 * So the window's whole state is here: the search, which branches are folded
 * shut, and which result is selected. Coming back to the tab finds the tree
 * exactly as it was left, which is the difference between a tool window and a
 * popup that happens to be wide.
 */
import { useSyncExternalStore } from "react";
import type { Position } from "@reviewer/core/language";
import { openBottomTab } from "@/lib/ui-prefs";
import type { UsageQuery } from "../interfaces/find-usages.interfaces";

interface FindUsagesState {
  /** The search being shown, or null before anything has been asked. */
  readonly query: UsageQuery | null;
  /** Branch ids the user has folded shut; everything else is open. */
  readonly collapsed: ReadonlySet<string>;
  /** The usage the preview is showing, by its tree id. */
  readonly selected: string | null;
}

const initial: FindUsagesState = {
  query: null,
  collapsed: new Set(),
  selected: null,
};

let state: FindUsagesState = initial;
const listeners = new Set<() => void>();

const set = (patch: Partial<FindUsagesState>) => {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
};

/**
 * Search for the usages of the symbol at `position`, and bring the window up.
 *
 * A new search starts with everything open and nothing selected: the previous
 * search's folds were about its results, and carrying them over would hide rows
 * of a tree the user has not seen yet.
 */
export const findUsages = (
  path: string,
  position: Position,
  symbol: string
): void => {
  set({
    query: { path, position, symbol, key: (state.query?.key ?? 0) + 1 },
    collapsed: new Set(),
    selected: null,
  });
  openBottomTab("find");
};

/**
 * Ask the same question again, keeping the tree's folds — a rerun is for
 * results that have moved on, not for a tree the user has lost their place in.
 */
export const rerunFindUsages = (): void => {
  if (state.query === null) return;
  set({ query: { ...state.query, key: state.query.key + 1 } });
};

export const setUsageCollapsed = (collapsed: ReadonlySet<string>): void =>
  set({ collapsed });

export const selectUsage = (selected: string | null): void => set({ selected });

/** Leaving the repository takes its symbols, and their positions, with it. */
export const resetFindUsages = (): void => {
  state = initial;
  for (const listener of listeners) listener();
};

export function useFindUsagesState(): FindUsagesState {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => state,
    () => state
  );
}
