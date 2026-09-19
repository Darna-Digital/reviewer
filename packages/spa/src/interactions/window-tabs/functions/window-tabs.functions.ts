/**
 * Transitions over the window-tab strip. All of it is decidable from the state
 * and a tab id, so none of it needs a rendered strip — or a router — to test.
 */
import { isFeatureEnabled } from "@reviewer/feature-flags";
import { dockPages } from "@/lib/shell-route";
import type {
  WindowTab,
  WindowTabsState,
} from "../interfaces/window-tabs.interfaces";

export const PROJECT_TAB_ID = "pinned-project";
export const SESSIONS_TAB_ID = "pinned-sessions";

export const HOME_HREF = "/modes/code/review";
export const SESSIONS_HREF = "/modes/agent-session";
/** `?new` holds the composer open instead of resuming the latest chat. */
export const NEW_SESSION_HREF = "/modes/agent-session?new=true";

const SESSIONS_PREFIX = "/modes/agent-session";
const TITLES: ReadonlyArray<readonly [string, string]> = [
  ["/modes/code/browse", "Project"],
  // Longest first: `/reviews` starts with `/review`, and a prefix match reads
  // the list as the diff view otherwise.
  ["/modes/code/reviews", "Merge requests"],
  ["/modes/code/review", "Review"],
  // The dock's surfaces, when one of them is the whole page. Named where they
  // are named everywhere else, so a card, a tab and a trail agree.
  ...dockPages.map((page): readonly [string, string] => [
    page.href,
    page.title,
  ]),
  ["/settings", "Settings"],
];

/** What a location calls itself in the strip. */
export function tabTitle(pathname: string): string {
  return (
    TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "Reviewer"
  );
}

const SESSIONS_TAB: WindowTab = {
  id: SESSIONS_TAB_ID,
  href: SESSIONS_HREF,
  title: "Sessions",
  kind: "sessions",
};

const PINNED_TABS: ReadonlyArray<WindowTab> = [
  {
    id: PROJECT_TAB_ID,
    href: HOME_HREF,
    title: tabTitle(HOME_HREF),
    kind: "project",
  },
  SESSIONS_TAB,
];

export const isPinnedTab = (tab: WindowTab): boolean => tab.kind !== "session";

/**
 * The tabs the strip shows. With its button switched off Sessions stays in the
 * strip — a conversation still has somewhere to be handed back to — but is left
 * out of the bar, leaving ⌘G nowhere to cross to. It comes back for as long as
 * the window is on it: a bar showing a page while highlighting none of its tabs
 * reads as having lost its place.
 */
export function stripTabs({
  tabs,
  activeId,
}: WindowTabsState): ReadonlyArray<WindowTab> {
  if (isFeatureEnabled("sessions-button")) return tabs;
  return tabs.filter((tab) => tab.kind !== "sessions" || tab.id === activeId);
}

/** Pinned tabs always lead the strip, so their count is also the first slot a
 * session tab may take. */
const firstSessionSlot = (tabs: ReadonlyArray<WindowTab>): number =>
  tabs.filter(isPinnedTab).length;

const inSessions = (pathname: string): boolean =>
  pathname.startsWith(SESSIONS_PREFIX);

/** A pinned tab that is named after wherever it has been left. */
const followsLocation = (tab: WindowTab): boolean => tab.kind === "project";

/**
 * Whether a tab remembers where it was left. Sessions does not: it is the way
 * to the list, and a tab that kept the conversation you last read would be a
 * way back into that one instead — the list reachable only by leaving it. A
 * conversation worth keeping open has a tab of its own to be lifted into.
 */
const keepsLocation = (tab: WindowTab): boolean => tab.kind !== "sessions";

/**
 * Collaboration was a mode of its own, with a pinned tab and pages under
 * `/modes/collaboration`, and its prototype lived on for a while under
 * `/modes/experimentation`. Both are gone, but a strip saved before they went
 * still names those pages, so no tab owns them any more — which sends the one
 * that was left there back to its own default rather than restoring it pointed
 * at a route that no longer exists.
 */
const LEGACY_PREFIXES = ["/modes/collaboration", "/modes/experimentation"];

/** Whether a location is a pinned tab's to hold. */
function ownsLocation(tab: WindowTab, pathname: string): boolean {
  if (LEGACY_PREFIXES.some((prefix) => pathname.startsWith(prefix)))
    return false;
  if (inSessions(pathname)) return tab.kind === "sessions";
  return tab.kind === "project";
}

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
 *
 * A tab only keeps a location that is still its own. A strip saved while a
 * feature was switched off can have left one of its locations on the wrong tab,
 * and a tab restored pointing outside its own part of the app is a tab that
 * takes you somewhere other than where it says.
 */
export function withPinnedTabs(
  tabs: ReadonlyArray<WindowTab>
): ReadonlyArray<WindowTab> {
  const saved = tabs.map((tab) => ({ ...tab, href: currentHref(tab.href) }));
  const pinned = PINNED_TABS.map((tab) => {
    const kept = saved.find((candidate) => candidate.id === tab.id);
    return kept === undefined ||
      !keepsLocation(tab) ||
      !ownsLocation(tab, kept.href)
      ? tab
      : { ...tab, href: kept.href, title: kept.title };
  });
  return [...pinned, ...saved.filter((tab) => tab.kind === "session")];
}

export const tabById = (
  { tabs }: WindowTabsState,
  id: string
): WindowTab | null => tabs.find((tab) => tab.id === id) ?? null;

export const activeTab = (state: WindowTabsState): WindowTab | null =>
  state.tabs.find((tab) => tab.id === state.activeId) ?? null;

/**
 * Whether the window is on a conversation's own tab — one session, lifted out
 * of the list, with the window to itself.
 *
 * The sessions surface and a session tab are the same URLs, so this is the only
 * thing that tells the two apart: on the Sessions tab a conversation is the
 * pane beside the list, and on its own tab it is the page. What the shell puts
 * around it differs accordingly — see `ChatsPage` for the list it stays out of,
 * and `ShellRoute` for the rail.
 */
export const onSessionTab = (state: WindowTabsState): boolean =>
  activeTab(state)?.kind === "session";

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
  const owner = sessions ? SESSIONS_TAB_ID : PROJECT_TAB_ID;
  return state.tabs.find((tab) => tab.id === owner) ?? null;
}

/**
 * Follow navigation: the owning tab takes the window and remembers where it was
 * left. A no-op when it is already active and points there, so an unrelated
 * re-render never rewrites the strip. Code is named after the surface it is on;
 * Sessions and its conversations carry their own names. Sessions takes the window without taking the location — it goes on
 * pointing at the list, wherever inside it you are.
 */
export function trackLocation(
  state: WindowTabsState,
  href: string,
  pathname: string
): WindowTabsState {
  const target = tabForLocation(state, pathname);
  if (target === null) return state;
  const title = followsLocation(target) ? tabTitle(pathname) : target.title;
  const at = keepsLocation(target) ? href : SESSIONS_HREF;
  if (
    target.id === state.activeId &&
    target.href === at &&
    target.title === title
  ) {
    return state;
  }
  return {
    activeId: target.id,
    tabs: state.tabs.map((tab) =>
      tab.id === target.id ? { ...tab, href: at, title } : tab
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
 * The way of working after the one the window is on, wrapping round — what ⌘G
 * crosses to. The pinned tabs are those ways of working, so the crossing is a
 * step along them — Code then Sessions, in strip order — and from a
 * conversation, which is had in either, it is the first. A window with only one
 * has nowhere to cross to.
 */
export function nextModeTab(
  tabs: ReadonlyArray<WindowTab>,
  activeId: string | null
): WindowTab | null {
  const modes = tabs.filter(isPinnedTab);
  if (modes.length < 2) return null;
  const at = modes.findIndex((tab) => tab.id === activeId);
  return modes[(at + 1) % modes.length] ?? null;
}

/**
 * The tab `offset` places along from the active one, wrapping round at either
 * end — what the macOS shell's Next Tab and Previous Tab step through. Every
 * tab counts, pinned or not: it is a walk along the strip as drawn, not the
 * ⌘<digit> run of the sessions alone.
 */
export function stepTab(
  tabs: ReadonlyArray<WindowTab>,
  activeId: string | null,
  offset: number
): WindowTab | null {
  if (tabs.length === 0) return null;
  const at = tabs.findIndex((tab) => tab.id === activeId);
  return tabs[(at + offset + tabs.length) % tabs.length] ?? null;
}

/**
 * The session standing in that slot of a strip, counting from 1. The pinned
 * tabs are skipped: they are off the digits altogether, so the conversations
 * are counted among themselves and none of them moves when a pinned tab is
 * switched on or off.
 */
export function sessionAtSlot(
  tabs: ReadonlyArray<WindowTab>,
  slot: number
): WindowTab | null {
  return tabs.filter((tab) => !isPinnedTab(tab))[slot - 1] ?? null;
}

const CHAT_HREF = /^\/modes\/agent-session\/([^/?#]+)/;

/** The conversation a session tab is showing, if it has got one yet. */
export function chatIdOf(href: string): string | null {
  return CHAT_HREF.exec(href)?.[1] ?? null;
}

/** What a session tab is called before its conversation has a name. */
export const NEW_SESSION_TITLE = "New session";
