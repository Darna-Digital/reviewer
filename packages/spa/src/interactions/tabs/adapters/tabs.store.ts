/**
 * The open-file strip, held in a small localStorage-backed store.
 *
 * Which files you have open is view state, not navigation — the URL already
 * carries the one file on screen, and putting the whole strip in it would make
 * every tab click a history entry. It is per workspace: one strip for all of
 * its repositories, each tab naming the repository it is in (see `tab-key`),
 * so moving between them keeps every file open. A strip saved before
 * workspaces — under one repository's root, of bare paths — is the strip of
 * that repository on its own, and its tabs are taken as that repository's.
 */
import { useSyncExternalStore } from "react";
import { adoptTabKey } from "../functions/tab-key";
import { EMPTY_TABS } from "../functions/tabs.functions";
import type { Tab, TabsState } from "../interfaces/tabs.interfaces";

const KEY_PREFIX = "reviewer-tabs:";

/** Which workspace the strip in memory belongs to. */
let scope: string | null = null;
let state: TabsState = EMPTY_TABS;
const listeners = new Set<() => void>();

const keyFor = (repo: string) => `${KEY_PREFIX}${repo}`;

const emit = () => {
  for (const listener of listeners) listener();
};

const isTab = (value: unknown): value is Tab =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Tab).path === "string";

const load = (workspace: string, repo: string | null): TabsState => {
  if (typeof window === "undefined") return EMPTY_TABS;
  try {
    const raw = window.localStorage.getItem(keyFor(workspace));
    if (raw === null) return EMPTY_TABS;
    const parsed = JSON.parse(raw) as Partial<TabsState>;
    const tabs = (parsed.tabs ?? []).filter(isTab).map((tab) => ({
      path: adoptTabKey(tab.path, repo),
      pinned: tab.pinned === true,
      // A restored tab is never a preview: coming back to a strip is a
      // deliberate act, and the first click would otherwise throw one away.
      preview: false,
    }));
    const saved =
      typeof parsed.active === "string"
        ? adoptTabKey(parsed.active, repo)
        : null;
    const active = tabs.some((tab) => tab.path === saved) ? saved : null;
    return { tabs, active };
  } catch {
    return EMPTY_TABS;
  }
};

const persist = () => {
  if (typeof window === "undefined" || scope === null) return;
  try {
    window.localStorage.setItem(keyFor(scope), JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
};

/**
 * Point the store at a workspace, loading its strip. Called as the page
 * learns which workspace is open; a no-op once it is pointed there. `repo`
 * is the repository a strip saved before workspaces is taken to be of.
 */
export const scopeTabsTo = (
  workspace: string | null,
  repo: string | null
): void => {
  if (workspace === scope) return;
  scope = workspace;
  state = workspace === null ? EMPTY_TABS : load(workspace, repo);
  emit();
};

/** Apply a transition from `tabs.functions`. */
export const updateTabs = (
  transition: (current: TabsState) => TabsState
): void => {
  const next = transition(state);
  if (next === state) return;
  state = next;
  persist();
  emit();
};

/** The strip as it stands, for effects that read it outside a render. */
export const readTabs = (): TabsState => state;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const snapshot = () => state;

export const useTabs = (): TabsState =>
  useSyncExternalStore(subscribe, snapshot, snapshot);
