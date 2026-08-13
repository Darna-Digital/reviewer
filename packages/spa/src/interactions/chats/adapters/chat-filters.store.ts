/**
 * The sessions list's filters, held in a small localStorage-backed store.
 *
 * Out here rather than in the page because the page unmounts on every
 * navigation, and a filter that forgets itself the moment you open a session is
 * a filter you have to set again every time you come back.
 */
import { useSyncExternalStore } from "react";
import { createStoredChatFilters } from "../functions/stored-chat-filters.functions";
import type { ChatFilters } from "../functions/chat-filters.functions";

const STORE_KEY = "byconvo-chat-filters";

const stored = createStoredChatFilters({
  data: {},
  sideEffects: {
    read: () =>
      typeof window === "undefined"
        ? null
        : window.localStorage.getItem(STORE_KEY),
    write: (value) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(STORE_KEY, value);
      } catch {
        // ignore quota errors
      }
    },
  },
});

let state: ChatFilters = stored.load();
const listeners = new Set<() => void>();

export function setChatFilters(patch: Partial<ChatFilters>): void {
  const next = { ...state, ...patch };
  if (next.project === state.project && next.date === state.date) return;
  state = next;
  stored.save(state);
  for (const listener of listeners) listener();
}

export const useChatFilters = (): ChatFilters =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state
  );
