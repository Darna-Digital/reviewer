/**
 * Asking the file viewer to bring a line into view.
 *
 * The URL cannot express this on its own. A jump to code sets `file` and `line`
 * in the search params and the shell reveals the line when they change — but
 * asking for the line that is *already* in the params changes nothing, so
 * nothing re-runs and the view sits exactly where it is. Clicking the same link
 * twice, or a second link that happens to resolve to the same line, then looks
 * broken: no scroll, no flash.
 *
 * So the request is a counter rather than a location. It changes on every ask,
 * whether or not the target did, which is the only thing that makes "take me
 * there again" expressible.
 */
import { useSyncExternalStore } from "react";

export interface CodeRevealRequest {
  /** Repository-relative path the line belongs to. */
  readonly path: string;
  /** One-based line to reveal once that file is on screen. */
  readonly line: number;
  /** Bumped on every request, so the same line can be asked for twice. */
  readonly key: number;
}

let state: CodeRevealRequest | null = null;
const listeners = new Set<() => void>();

/**
 * Ask for `line` of `path`. The file may not be on screen yet — navigation is
 * the caller's job and lands a moment later — so the request waits to be picked
 * up rather than being spent immediately.
 */
export function requestCodeReveal(path: string, line: number): void {
  state = { path, line, key: (state?.key ?? 0) + 1 };
  for (const listener of listeners) listener();
}

/** The request as it stands, for callers outside a React tree. */
export const codeRevealSnapshot = (): CodeRevealRequest | null => state;

export const useCodeReveal = (): CodeRevealRequest | null =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state
  );
