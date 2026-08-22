/**
 * Whether the project picker is open.
 *
 * The chip rides the header, the chord that raises it is the window bar's and
 * the command that does the same is registered by the layout — so the flag
 * lives here rather than in the state of any of them. It closes with the
 * project you pick, so it is neither navigation nor a preference.
 */
import { useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();

export function setProjectPickerOpen(next: boolean): void {
  if (next === open) return;
  open = next;
  for (const listener of listeners) listener();
}

export const openProjectPicker = (): void => setProjectPickerOpen(true);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useProjectPickerOpen = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => open,
    () => false
  );
