/**
 * What the history dock is filtered to, held outside both of them.
 *
 * The dock lives in the layout and the code page lives in the outlet beneath
 * it, so "show me this file's history" — asked for from a file's tab, its
 * context menu, or the path bar — has nowhere to travel as a prop. It is a
 * small shared reading rather than a message, so it lives here, in the same
 * shape as the app's other module stores.
 *
 * The ref resets when the repository changes: a branch name means something
 * different, or nothing, in another repository.
 */
import { useSyncExternalStore } from "react";
import { emptyLogQuery, type LogQuery } from "@/lib/api/types";

interface HistoryFilters {
  /** The ref whose history the dock lists, or null to follow HEAD. */
  readonly ref: string | null;
  readonly query: LogQuery;
}

const initial: HistoryFilters = {
  ref: null,
  query: emptyLogQuery,
};

let state: HistoryFilters = initial;
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

const set = (patch: Partial<HistoryFilters>) => {
  state = { ...state, ...patch };
  emit();
};

export const setHistoryRef = (ref: string | null) => set({ ref });
export const setHistoryQuery = (query: LogQuery) => set({ query });

/** Follow one file's past — the "Show history" action, from wherever it is. */
export const showPathHistory = (query: LogQuery) => set({ query });

/** Leaving a repository takes its refs and its filters with it. */
export const resetHistoryFilters = () => {
  state = initial;
  emit();
};

export function useHistoryFilters(): HistoryFilters {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => state,
    () => state
  );
}
