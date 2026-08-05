// Adapted from Lina by SameerJS6 (https://lina.sameer.sh) — use-has-primary-touch.
// Detects touch-primary devices (coarse pointer + touch points), updating live
// on pointer-mode and media-query changes. All consumers share one module-level
// subscription that only notifies when the answer flips, and the first client
// render reads the real value synchronously so components don't swap subtrees
// right after mount.

import { useSyncExternalStore } from "react";

const detect = () =>
  ("ontouchstart" in window || navigator.maxTouchPoints > 0) &&
  window.matchMedia("(pointer: coarse)").matches;

let snapshot: boolean | null = null;
const subscribers = new Set<() => void>();

const refresh = () => {
  const next = detect();
  if (next === snapshot) return;
  snapshot = next;
  for (const notify of subscribers) notify();
};

let detach: (() => void) | null = null;

const attach = () => {
  const controller = new AbortController();
  const { signal } = controller;
  window
    .matchMedia("(pointer: coarse)")
    .addEventListener("change", refresh, { signal });
  window.addEventListener("pointerdown", refresh, { signal });
  return () => controller.abort();
};

const subscribe = (onChange: () => void) => {
  subscribers.add(onChange);
  detach ??= attach();
  return () => {
    subscribers.delete(onChange);
    if (subscribers.size === 0) {
      detach?.();
      detach = null;
    }
  };
};

const getSnapshot = () => (snapshot ??= detect());

export function useTouchPrimary() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
