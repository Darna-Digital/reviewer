/**
 * The collaboration strip, held in a small localStorage-backed store — which
 * surfaces you keep open is view state, not navigation, so it survives a reload
 * the way the window's own tabs do.
 */
import { useSyncExternalStore } from "react";
import { initialCollaborationTabs } from "../functions/collaboration-tabs.functions";
import type {
  CollaborationTab,
  CollaborationTabsState,
} from "../interfaces/collaboration-tabs.interfaces";

const STORE_KEY = "reviewer-collaboration-tabs";

let sequence = 0;
export const nextTabId = (): string => `collab-tab-${(sequence += 1)}`;

const isTab = (value: unknown): value is CollaborationTab =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as CollaborationTab).id === "string" &&
  typeof (value as CollaborationTab).href === "string" &&
  typeof (value as CollaborationTab).title === "string" &&
  typeof (value as CollaborationTab).kind === "string" &&
  typeof (value as CollaborationTab).subject === "string";

function load(): CollaborationTabsState {
  if (typeof window === "undefined")
    return initialCollaborationTabs(nextTabId());
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw === null) return initialCollaborationTabs(nextTabId());
    const parsed = JSON.parse(raw) as Partial<CollaborationTabsState>;
    const tabs = (parsed.tabs ?? []).filter(isTab);
    if (tabs.length === 0) return initialCollaborationTabs(nextTabId());
    // Restored ids must not collide with ones minted this session, and a strip
    // that has had tabs closed is not numbered contiguously.
    sequence = tabs.reduce(
      (highest, tab) =>
        Math.max(highest, Number(tab.id.replace("collab-tab-", "")) || 0),
      0
    );
    const activeId =
      typeof parsed.activeId === "string" &&
      tabs.some((tab) => tab.id === parsed.activeId)
        ? parsed.activeId
        : tabs[0].id;
    return { tabs, activeId };
  } catch {
    return initialCollaborationTabs(nextTabId());
  }
}

let state: CollaborationTabsState = load();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

/** Apply a transition from `collaboration-tabs.functions`. */
export function updateCollaborationTabs(
  transition: (current: CollaborationTabsState) => CollaborationTabsState
): void {
  const next = transition(state);
  if (next === state) return;
  state = next;
  persist();
  for (const listener of listeners) listener();
}

export const useCollaborationTabs = (): CollaborationTabsState =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state
  );
