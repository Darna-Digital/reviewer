/**
 * The window-tab strip, held in a small localStorage-backed store.
 *
 * Which places you keep open is view state, not navigation — the URL already
 * carries the one on screen. Unlike the editor's file strip this one spans
 * repositories, so it is stored under a single key.
 */
import { useSyncExternalStore } from "react";
import { isPreviewWindow } from "@/lib/preview-window";
import {
  initialWindowTabs,
  NEW_SESSION_TITLE,
  withPinnedTabs,
} from "../functions/window-tabs.functions";
import type {
  WindowTab,
  WindowTabKind,
  WindowTabsState,
} from "../interfaces/window-tabs.interfaces";

const STORE_KEY = "byconvo-window-tabs";

let sequence = 0;
export const nextTabId = (): string => `tab-${(sequence += 1)}`;

const KINDS: ReadonlyArray<WindowTabKind> = [
  "project",
  "collaboration",
  "sessions",
  "session",
];

// A strip written before the pinned tabs existed carries no `kind`, so every
// tab in it fails here and the restore falls back to a fresh pinned strip.
const isTab = (value: unknown): value is WindowTab =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as WindowTab).id === "string" &&
  typeof (value as WindowTab).href === "string" &&
  KINDS.includes((value as WindowTab).kind);

function load(): WindowTabsState {
  if (typeof window === "undefined") return initialWindowTabs();
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw === null) return initialWindowTabs();
    const parsed = JSON.parse(raw) as Partial<WindowTabsState>;
    const tabs = withPinnedTabs(
      (parsed.tabs ?? []).filter(isTab).map((tab) => ({
        id: tab.id,
        href: tab.href,
        title: typeof tab.title === "string" ? tab.title : NEW_SESSION_TITLE,
        kind: tab.kind,
      }))
    );
    // Restored ids must not collide with ones minted this session, and a strip
    // that has had tabs closed is not numbered contiguously.
    sequence = tabs.reduce(
      (highest, tab) => Math.max(highest, Number(tab.id.slice(4)) || 0),
      0
    );
    const activeId =
      typeof parsed.activeId === "string" &&
      tabs.some((tab) => tab.id === parsed.activeId)
        ? parsed.activeId
        : tabs[0].id;
    return { tabs, activeId };
  } catch {
    return initialWindowTabs();
  }
}

let state: WindowTabsState = load();
const listeners = new Set<() => void>();

function persist() {
  // A preview shares the window's storage: the strip it draws is a picture of
  // this one, and must never write back over it.
  if (typeof window === "undefined" || isPreviewWindow) return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

/** Apply a transition from `window-tabs.functions`. */
export function updateWindowTabs(
  transition: (current: WindowTabsState) => WindowTabsState
): void {
  const next = transition(state);
  if (next === state) return;
  state = next;
  persist();
  for (const listener of listeners) listener();
}

/**
 * The strip as it is right now, for handlers that fire outside React's render
 * cycle — a keyboard shortcut can arrive in the same task as the change before
 * it, where the value closed over by the last render is already out of date.
 */
export const windowTabsSnapshot = (): WindowTabsState => state;

export const useWindowTabs = (): WindowTabsState =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state
  );
