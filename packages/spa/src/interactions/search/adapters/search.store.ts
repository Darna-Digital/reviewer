/**
 * Whether the search dialog is open, and on which list. It lives in a tiny
 * store rather than in a shell's `useState` because the dialog belongs to no
 * single page: every code-mode page can open it, and pages that contribute
 * commands to it (a shell with panels to toggle, a picker to raise) come and go
 * as you navigate. Those pages register their commands here for as long as they
 * are mounted.
 */
import { useEffect, useSyncExternalStore } from "react";
import type { Command, SearchMode } from "../interfaces/search.interfaces";

/**
 * A phrase the dialog should open holding, and the press that supplied it. The
 * nonce is what lets the same word be sent twice: ⌘⇧F over `useFiles`, escape,
 * ⌘⇧F over `useFiles` again is two requests, not one.
 */
export interface SearchSeed {
  readonly text: string;
  readonly nonce: number;
}

export interface SearchState {
  readonly open: boolean;
  readonly mode: SearchMode;
  /** Null when the dialog should keep whatever query it had. */
  readonly seed: SearchSeed | null;
}

const CLOSED: SearchState = { open: false, mode: "commands", seed: null };

let state: SearchState = CLOSED;
/** Scope name → the commands that scope currently offers, in mount order. */
const scopes = new Map<string, ReadonlyArray<Command>>();
let registered: ReadonlyArray<Command> = [];

const stateListeners = new Set<() => void>();
const commandListeners = new Set<() => void>();

const emit = (listeners: Set<() => void>) => {
  for (const listener of listeners) listener();
};

const setState = (next: SearchState) => {
  if (
    next.open === state.open &&
    next.mode === state.mode &&
    next.seed === state.seed
  ) {
    return;
  }
  state = next;
  emit(stateListeners);
};

let seeds = 0;

/**
 * Open the dialog on `mode` — what the ⇧⇧ and ⌘⇧F gestures do. A `seed` is the
 * phrase the caller had highlighted; an empty one means there was nothing
 * highlighted, and the box keeps what it already held.
 */
export const openSearch = (mode: SearchMode, seed = ""): void =>
  setState({
    open: true,
    mode,
    seed: seed === "" ? null : { text: seed, nonce: ++seeds },
  });

/**
 * The mode is deliberately left as it was: the dialog animates out, and
 * changing the list in the same commit would flash the commands over the
 * results you just dismissed. Every way back in names the mode it wants.
 */
export const closeSearch = (): void => setState({ ...state, open: false });

export const setSearchOpen = (open: boolean): void =>
  open ? setState({ ...state, open: true }) : closeSearch();

export const setSearchMode = (mode: SearchMode): void =>
  setState({ ...state, mode });

/**
 * ⌘K. A second press closes the command list, but from another mode it brings
 * the commands back first rather than closing what you were doing.
 */
export const toggleCommandSearch = (): void =>
  state.open && state.mode === "commands"
    ? closeSearch()
    : // The command list is not a search, so nothing seeds it.
      setState({ open: true, mode: "commands", seed: null });

const rebuildCommands = () => {
  registered = [...scopes.values()].flat();
  emit(commandListeners);
};

/**
 * Offer `commands` while the caller is mounted. Re-registering the same scope
 * replaces its commands, so a shell can hand over a fresh list as its state
 * changes (a toggle's label follows what it would do next).
 */
export const registerCommands = (
  scope: string,
  commands: ReadonlyArray<Command>
): (() => void) => {
  scopes.set(scope, commands);
  rebuildCommands();
  return () => {
    scopes.delete(scope);
    rebuildCommands();
  };
};

const subscribeState = (listener: () => void) => {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
};

const subscribeCommands = (listener: () => void) => {
  commandListeners.add(listener);
  return () => commandListeners.delete(listener);
};

const searchSnapshot = () => state;
const commandsSnapshot = () => registered;

export const useSearchState = (): SearchState =>
  useSyncExternalStore(subscribeState, searchSnapshot, searchSnapshot);

/** Every command the mounted pages currently offer. */
export const useRegisteredCommands = (): ReadonlyArray<Command> =>
  useSyncExternalStore(subscribeCommands, commandsSnapshot, commandsSnapshot);

/**
 * Offer `commands` for as long as the calling page is mounted. `commands` has
 * to be memoised — it is what tells the store the list has changed.
 */
export const useRegisterCommands = (
  scope: string,
  commands: ReadonlyArray<Command>
): void => {
  useEffect(() => registerCommands(scope, commands), [scope, commands]);
};

/** Test seam: forget everything the mounted pages registered. */
export const resetSearchStore = (): void => {
  state = CLOSED;
  seeds = 0;
  scopes.clear();
  registered = [];
  emit(stateListeners);
  emit(commandListeners);
};
