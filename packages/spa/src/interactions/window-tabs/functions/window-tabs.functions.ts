/**
 * Transitions over the window-tab strip. All of it is decidable from the state
 * and a tab id, so none of it needs a rendered strip — or a router — to test.
 */
import type {
  WindowTab,
  WindowTabsState,
} from "../interfaces/window-tabs.interfaces";

export const PROJECT_TAB_ID = "pinned-project";
export const COLLABORATION_TAB_ID = "pinned-collaboration";
export const SESSIONS_TAB_ID = "pinned-sessions";

export const HOME_HREF = "/modes/code/commit";
export const COLLABORATION_HREF = "/modes/collaboration";
export const SESSIONS_HREF = "/modes/agent-session";
/** `?new` holds the composer open instead of resuming the latest chat. */
export const NEW_SESSION_HREF = "/modes/agent-session?new=true";

const SESSIONS_PREFIX = "/modes/agent-session";
const COLLABORATION_PREFIX = "/modes/collaboration";

const TITLES: ReadonlyArray<readonly [string, string]> = [
  ["/modes/code/browse", "Project"],
  ["/modes/code/commit", "Local changes"],
  ["/modes/code/review", "Pull requests"],
  ["/modes/code/docs", "Docs"],
  ["/modes/code/tasks", "Tasks"],
  ["/modes/collaboration/inbox", "Inbox"],
  ["/modes/collaboration", "Collaboration"],
  ["/settings", "Settings"],
];

/** What a location calls itself in the strip. */
export function tabTitle(pathname: string): string {
  return (
    TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "Byconvo"
  );
}

const PINNED_TABS: ReadonlyArray<WindowTab> = [
  {
    id: PROJECT_TAB_ID,
    href: HOME_HREF,
    title: tabTitle(HOME_HREF),
    kind: "project",
  },
  {
    id: COLLABORATION_TAB_ID,
    href: COLLABORATION_HREF,
    title: tabTitle(COLLABORATION_HREF),
    kind: "collaboration",
  },
  {
    id: SESSIONS_TAB_ID,
    href: SESSIONS_HREF,
    title: "Sessions",
    kind: "sessions",
  },
];

export const isPinnedTab = (tab: WindowTab): boolean => tab.kind !== "session";

/** Pinned tabs always lead the strip, so their count is also the first slot a
 * session tab may take. */
const firstSessionSlot = (tabs: ReadonlyArray<WindowTab>): number =>
  tabs.filter(isPinnedTab).length;

const inSessions = (pathname: string): boolean =>
  pathname.startsWith(SESSIONS_PREFIX);

const inCollaboration = (pathname: string): boolean =>
  pathname.startsWith(COLLABORATION_PREFIX);

/** A pinned tab that is named after wherever it has been left. */
const followsLocation = (tab: WindowTab): boolean =>
  tab.kind === "project" || tab.kind === "collaboration";

/** The strip a window opens with: the pinned tabs, on Code. */
export const initialWindowTabs = (): WindowTabsState => ({
  tabs: PINNED_TABS,
  activeId: PROJECT_TAB_ID,
});

/** Sessions used to live under code mode, and a saved strip still says so. */
const LEGACY_SESSIONS_PREFIX = "/modes/code/chats";

/** Where a saved href points now — the route it named may since have moved. */
export const currentHref = (href: string): string =>
  href.startsWith(LEGACY_SESSIONS_PREFIX)
    ? SESSIONS_PREFIX + href.slice(LEGACY_SESSIONS_PREFIX.length)
    : href;

/**
 * Restore the pinned tabs at the head of a strip, each keeping where it was
 * left, and drop anything that is neither pinned nor a session.
 */
export function withPinnedTabs(
  tabs: ReadonlyArray<WindowTab>
): ReadonlyArray<WindowTab> {
  const saved = tabs.map((tab) => ({ ...tab, href: currentHref(tab.href) }));
  const pinned = PINNED_TABS.map((tab) => {
    const kept = saved.find((candidate) => candidate.id === tab.id);
    return kept === undefined
      ? tab
      : { ...tab, href: kept.href, title: kept.title };
  });
  return [...pinned, ...saved.filter((tab) => tab.kind === "session")];
}

export const activeTab = (state: WindowTabsState): WindowTab | null =>
  state.tabs.find((tab) => tab.id === state.activeId) ?? null;

/**
 * Where a location belongs. A session tab holds one conversation, so it keeps
 * anything inside Sessions; everything else lands on the pinned tab that owns
 * that part of the app, whichever tab you set off from — leaving Sessions from
 * a chat hands the window back to Code rather than overwriting the chat.
 */
function tabForLocation(
  state: WindowTabsState,
  pathname: string
): WindowTab | null {
  const current = activeTab(state);
  const sessions = inSessions(pathname);
  if (current !== null && current.kind === "session" && sessions)
    return current;
  const owner = sessions
    ? SESSIONS_TAB_ID
    : inCollaboration(pathname)
      ? COLLABORATION_TAB_ID
      : PROJECT_TAB_ID;
  return state.tabs.find((tab) => tab.id === owner) ?? current;
}

/**
 * Follow navigation: the owning tab takes the window and remembers where it was
 * left. A no-op when it is already active and points there, so an unrelated
 * re-render never rewrites the strip. Code and Collaboration are named after
 * the surface they are on; Sessions and its conversations carry their own
 * names.
 */
export function trackLocation(
  state: WindowTabsState,
  href: string,
  pathname: string
): WindowTabsState {
  const target = tabForLocation(state, pathname);
  if (target === null) return state;
  const title = followsLocation(target) ? tabTitle(pathname) : target.title;
  if (
    target.id === state.activeId &&
    target.href === href &&
    target.title === title
  ) {
    return state;
  }
  return {
    activeId: target.id,
    tabs: state.tabs.map((tab) =>
      tab.id === target.id ? { ...tab, href, title } : tab
    ),
  };
}

/** Open a tab next to the active one, as every browser does, and go to it. */
export function openTab(
  state: WindowTabsState,
  tab: WindowTab
): WindowTabsState {
  const after =
    state.tabs.findIndex((existing) => existing.id === state.activeId) + 1;
  const tabs = [...state.tabs];
  tabs.splice(Math.max(after, firstSessionSlot(state.tabs)), 0, tab);
  return { tabs, activeId: tab.id };
}

export function selectTab(state: WindowTabsState, id: string): WindowTabsState {
  if (id === state.activeId || !state.tabs.some((tab) => tab.id === id))
    return state;
  return { ...state, activeId: id };
}

/** Name a session tab after its conversation, once the chat list knows it. */
export function renameTab(
  state: WindowTabsState,
  id: string,
  title: string
): WindowTabsState {
  const tab = state.tabs.find((candidate) => candidate.id === id);
  if (tab === undefined || tab.title === title) return state;
  return {
    ...state,
    tabs: state.tabs.map((candidate) =>
      candidate.id === id ? { ...candidate, title } : candidate
    ),
  };
}

/**
 * Close a session tab. Closing the active one hands the window to its
 * right-hand neighbour (the left-hand one at the end of the strip). The pinned
 * tabs do not close, so the strip is never empty.
 */
export function closeTab(state: WindowTabsState, id: string): WindowTabsState {
  const at = state.tabs.findIndex((tab) => tab.id === id);
  if (at < 0 || isPinnedTab(state.tabs[at])) return state;
  const tabs = state.tabs.filter((tab) => tab.id !== id);
  if (id !== state.activeId) return { ...state, tabs };
  return { tabs, activeId: tabs[Math.min(at, tabs.length - 1)].id };
}

/** Drop a session tab at `toIndex`, sliding the ones it passes over out of its
 * way. Pinned tabs neither move nor give up their slots. */
export function moveTab(
  state: WindowTabsState,
  id: string,
  toIndex: number
): WindowTabsState {
  const from = state.tabs.findIndex((tab) => tab.id === id);
  if (from < 0 || isPinnedTab(state.tabs[from])) return state;
  const to = Math.max(
    firstSessionSlot(state.tabs),
    Math.min(toIndex, state.tabs.length - 1)
  );
  if (from === to) return state;
  const tabs = [...state.tabs];
  const [moved] = tabs.splice(from, 1);
  tabs.splice(to, 0, moved);
  return { ...state, tabs };
}

/**
 * The tab a ⌘<digit> jumps to. 1–8 count from the left; 9 is the last tab
 * however many there are, which is the convention every browser follows.
 */
export function tabAtPosition(
  tabs: ReadonlyArray<WindowTab>,
  position: number
): WindowTab | null {
  const index = position >= 9 ? tabs.length - 1 : position - 1;
  return tabs[index] ?? null;
}

const CHAT_HREF = /^\/modes\/agent-session\/([^/?#]+)/;

/** The conversation a session tab is showing, if it has got one yet. */
export function chatIdOf(href: string): string | null {
  return CHAT_HREF.exec(href)?.[1] ?? null;
}

/** What a session tab is called before its conversation has a name. */
export const NEW_SESSION_TITLE = "New session";
