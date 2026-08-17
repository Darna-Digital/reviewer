/**
 * A localStorage-backed store of unsent composer text, keyed however the
 * composer that owns it is identified (a chat id, a repository path). Text
 * being typed outlives the component typing it: a composer unmounts whenever
 * the view around it changes, and a reload takes the whole tree with it.
 */
import { useCallback, useSyncExternalStore } from "react";

type Drafts = Record<string, string>;

export interface DraftStore {
  readonly setDraft: (key: string, text: string) => void;
  /** The draft text for `key` and a stable setter, live across mounts. */
  readonly useDraft: (key: string) => readonly [string, (text: string) => void];
}

export function makeDraftStore(storeKey: string): DraftStore {
  const load = (): Drafts => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(storeKey);
      if (raw !== null) return JSON.parse(raw) as Drafts;
    } catch {
      // ignore malformed storage
    }
    return {};
  };

  let state: Drafts = load();
  const listeners = new Set<() => void>();

  const persist = () => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storeKey, JSON.stringify(state));
    } catch {
      // ignore quota errors
    }
  };

  const setDraft = (key: string, text: string): void => {
    if ((state[key] ?? "") === text) return;
    if (text.length === 0) {
      if (!(key in state)) return;
      const { [key]: _removed, ...rest } = state;
      state = rest;
    } else {
      state = { ...state, [key]: text };
    }
    persist();
    for (const listener of listeners) listener();
  };

  const useDraft = (key: string) => {
    const text = useSyncExternalStore(
      (cb) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      () => state[key] ?? "",
      () => state[key] ?? ""
    );
    const set = useCallback((next: string) => setDraft(key, next), [key]);
    return [text, set] as const;
  };

  return { setDraft, useDraft };
}
