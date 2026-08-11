/**
 * Which mode each session's composer is in, keyed by chat id, with
 * `NEW_SESSION` for the one that does not exist yet.
 *
 * Out here rather than in the composer because the composer unmounts on every
 * navigation, and because the mode is set from outside it — the analysis pane's
 * "new analysis" is exactly "a new session, in analysis mode". Not persisted: a
 * reloaded window has no half-finished intent to honour.
 */
import { useSyncExternalStore } from "react";
import type { ChatMode } from "../functions/chat-mode.functions";

export const NEW_SESSION = "new";

let modes: Readonly<Record<string, ChatMode>> = {};
const listeners = new Set<() => void>();

export const setChatMode = (key: string, mode: ChatMode): void => {
  if (modes[key] === mode) return;
  modes = { ...modes, [key]: mode };
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
