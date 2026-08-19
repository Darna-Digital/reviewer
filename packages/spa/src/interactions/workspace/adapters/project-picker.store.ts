/**
 * Whether the project picker is open.
 *
 * The chip rides the window bar, which the frame draws for itself, while the
 * command that raises it is registered by the layout above — so the flag lives
 * here rather than in the state of either. It closes with the project you pick,
 * so it is neither navigation nor a preference.
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
