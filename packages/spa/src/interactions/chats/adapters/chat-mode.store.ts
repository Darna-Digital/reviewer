/**
 * Which mode each session's composer is in, keyed by chat id, with
 * `NEW_SESSION` for the one that does not exist yet.
 *
 * Out here rather than in the composer because the composer unmounts on every
 * navigation, and because the mode is set from outside it — the analysis pane's
 * "new analysis" is exactly "a new session, in analysis mode".
 *
 * A session that exists is only held for as long as the window is open; the one
 * that does not exist yet is kept, because the mode a fresh composer opens in is
 * a way of working rather than a half-finished intent — somebody drawing
 * analyses is still drawing them after a reload.
 */
import { useSyncExternalStore } from "react";
import { readUiPrefs, rememberSession } from "@/lib/ui-prefs";
import type { ChatMode } from "../functions/chat-mode.functions";

export const NEW_SESSION = "new";

let modes: Readonly<Record<string, ChatMode>> = {
  [NEW_SESSION]: readUiPrefs().lastSession.mode,
};
const listeners = new Set<() => void>();

export const setChatMode = (key: string, mode: ChatMode): void => {
  if (modes[key] === mode) return;
  modes = { ...modes, [key]: mode };
  if (key === NEW_SESSION) rememberSession({ mode });
  for (const listener of listeners) listener();
};

export const useChatMode = (key: string): ChatMode =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => modes[key] ?? "build",
    () => "build"
  );
