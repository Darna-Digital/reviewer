/**
 * Transitions over the collaboration strip, and what a location is called in
 * it. All of it is decidable from the state, an href and a tab id, so none of
 * it needs a rendered strip — or a router — to test.
 */
import {
  DEFAULT_ID,
  DEFAULT_VIEW,
  findChat,
  findProject,
  findScope,
  findTask,
  type CollaborationView,
} from "@/interactions/collaboration/data/collaboration.mock";
import type {
  CollaborationPlace,
  CollaborationTab,
  CollaborationTabKind,
  CollaborationTabsState,
} from "../interfaces/collaboration-tabs.interfaces";

export const COLLABORATION_PATH = "/modes/collaboration";
export const INBOX_PATH = "/modes/collaboration/inbox";

export const viewHref = (view: CollaborationView, id: string): string =>
  `${COLLABORATION_PATH}?view=${view}&id=${encodeURIComponent(id)}`;

export const DEFAULT_HREF = viewHref(DEFAULT_VIEW, DEFAULT_ID);

/** What a surface calls itself, from whatever the mock data knows of it. */
function locationTitle(kind: CollaborationTabKind, id: string): string {
  switch (kind) {
    case "inbox":
      return "Inbox";
    case "project":
      return findProject(id)?.name ?? "Project";
    case "tasks":
      return `${findProject(id)?.name ?? "Project"} tasks`;
    case "flow":
      return `${findProject(id)?.name ?? "Project"} flow`;
    case "outlook":
      return `Outlook · ${findScope(id)?.name ?? "This week"}`;
    case "docs":
      return `${findProject(id)?.name ?? "Project"} docs`;
    case "task":
      return findTask(id)?.title ?? "Task";
    case "chat":
      return findChat(id)?.title ?? "Chat";
    case "agents":
      return "Agents";
    case "members":
      return "People";
  }
}

/** The surface a location is on, as the strip holds it. */
export function describeLocation(
  pathname: string,
  search: { view?: CollaborationView; id?: string }
): CollaborationPlace {
  const inbox = pathname.startsWith(INBOX_PATH);
  const kind: CollaborationTabKind = inbox
    ? "inbox"
    : (search.view ?? DEFAULT_VIEW);
  const subject = inbox ? "" : (search.id ?? DEFAULT_ID);
  return { kind, subject, title: locationTitle(kind, subject) };
}

export const DEFAULT_PLACE: CollaborationPlace = {
  kind: DEFAULT_VIEW,
  subject: DEFAULT_ID,
  title: locationTitle(DEFAULT_VIEW, DEFAULT_ID),
};

export const initialCollaborationTabs = (
  id: string
): CollaborationTabsState => ({
  tabs: [{ id, href: DEFAULT_HREF, ...DEFAULT_PLACE }],
  activeId: id,
});

export const activeTab = (
  state: CollaborationTabsState
): CollaborationTab | null =>
  state.tabs.find((tab) => tab.id === state.activeId) ?? null;

/**
 * Follow navigation: the active tab takes the surface and is renamed after it.
 * A no-op when it already points there, so an unrelated re-render never
 * rewrites the strip.
 */
export function trackLocation(
  state: CollaborationTabsState,
  href: string,
  place: CollaborationPlace
): CollaborationTabsState {
  const current = activeTab(state);
  if (current === null) return state;
  if (
    current.href === href &&
    current.kind === place.kind &&
    current.subject === place.subject &&
    current.title === place.title
  ) {
    return state;
  }
  return {
    ...state,
    tabs: state.tabs.map((tab) =>
      tab.id === current.id ? { ...tab, href, ...place } : tab
    ),
  };
}

/** Open a tab next to the active one, as every browser does, and go to it. */
export function openTab(
  state: CollaborationTabsState,
  tab: CollaborationTab
): CollaborationTabsState {
  const after =
    state.tabs.findIndex((existing) => existing.id === state.activeId) + 1;
  const tabs = [...state.tabs];
  tabs.splice(after, 0, tab);
  return { tabs, activeId: tab.id };
}

export function selectTab(
  state: CollaborationTabsState,
  id: string
): CollaborationTabsState {
  if (id === state.activeId || !state.tabs.some((tab) => tab.id === id))
    return state;
  return { ...state, activeId: id };
}

/**
 * Close a tab. Closing the active one hands the mode to its right-hand
 * neighbour (the left-hand one at the end of the strip); the last tab stays, so
 * the strip is never empty.
 */
export function closeTab(
  state: CollaborationTabsState,
  id: string
): CollaborationTabsState {
  if (state.tabs.length === 1) return state;
  const at = state.tabs.findIndex((tab) => tab.id === id);
  if (at < 0) return state;
  const tabs = state.tabs.filter((tab) => tab.id !== id);
  if (id !== state.activeId) return { ...state, tabs };
  return { tabs, activeId: tabs[Math.min(at, tabs.length - 1)].id };
}

/** Drop a tab at `toIndex`, sliding the ones it passes over out of its way. */
export function moveTab(
  state: CollaborationTabsState,
  id: string,
  toIndex: number
): CollaborationTabsState {
  const from = state.tabs.findIndex((tab) => tab.id === id);
  const to = Math.max(0, Math.min(toIndex, state.tabs.length - 1));
  if (from < 0 || from === to) return state;
  const tabs = [...state.tabs];
  const [moved] = tabs.splice(from, 1);
  tabs.splice(to, 0, moved);
  return { ...state, tabs };
}
