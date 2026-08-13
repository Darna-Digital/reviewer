/**
 * Which preview frames are being kept alive.
 *
 * A booted frame is an app that is already up: hovering the same tab twice
 * should cost nothing the second time. So a frame is not torn down when its
 * preview closes — the popup around it is hidden and the document goes on
 * living, ready to be shown again — and this store is what bounds that: the
 * least recently shown frames fall out of the list and are dropped, so the
 * window never accumulates more of them than it is using.
 */
import { useSyncExternalStore } from "react";
import { keepWarm } from "../functions/tab-preview.functions";

let warm: ReadonlyArray<string> = [];
const listeners = new Set<() => void>();

/** Mark a frame as the one most recently shown, and drop the coldest. */
export function warmPreview(key: string): void {
  const next = keepWarm(warm, key);
  if (next === warm) return;
  warm = next;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useWarmPreview = (key: string): boolean =>
  useSyncExternalStore(
    subscribe,
    () => warm.includes(key),
    () => false
  );
