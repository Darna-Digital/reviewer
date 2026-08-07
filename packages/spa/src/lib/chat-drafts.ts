/**
 * Composer drafts — the unsent prompt text for each chat, kept out of the
 * composer's own component state so navigating between threads (which unmounts
 * the composer) doesn't discard what you were typing. Keyed by chat id, with
 * `NEW_CHAT_DRAFT` for the not-yet-created thread on the /chats index. Backed
 * by localStorage so a reload keeps the draft too; entries clear on send.
 */
import { useCallback, useSyncExternalStore } from "react";

/** Draft key for the new-thread composer on the /chats index. */
export const NEW_CHAT_DRAFT = "new";

/**
 * Draft key for the analysis composer in the plans pane. Its own key rather
 * than the new-thread one: the pane and the /chats index can be on screen at
 * the same time, and a half-written question is not a half-written message.
 */
export const ANALYSIS_DRAFT = "plans-analysis";

const STORE_KEY = "byconvo-chat-drafts";

type Drafts = Record<string, string>;

function load(): Drafts {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw !== null) return JSON.parse(raw) as Drafts;
  } catch {
    // ignore malformed storage
  }
  return {};
}

let state: Drafts = load();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

function emit() {
  for (const l of listeners) l();
}

export function setDraft(key: string, text: string): void {
  if ((state[key] ?? "") === text) return;
  if (text.length === 0) {
    if (!(key in state)) return;
    const { [key]: _removed, ...rest } = state;
    state = rest;
  } else {
    state = { ...state, [key]: text };
  }
  persist();
  emit();
}

/** The draft text for `key` and a stable setter, updating live across mounts. */
export function useDraft(
  key: string
): readonly [string, (text: string) => void] {
  const text = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state[key] ?? "",
    () => state[key] ?? ""
  );
  const set = useCallback((next: string) => setDraft(key, next), [key]);
  return [text, set];
}
