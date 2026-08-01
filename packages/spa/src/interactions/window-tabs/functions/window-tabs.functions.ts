/**
 * Transitions over the window-tab strip. All of it is decidable from the state
 * and a tab id, so none of it needs a rendered strip — or a router — to test.
 */
import type {
  WindowTab,
  WindowTabsState,
} from "../interfaces/window-tabs.interfaces"

/** The strip is never empty: a window always shows something. */
export const initialWindowTabs = (tab: WindowTab): WindowTabsState => ({
  tabs: [tab],
  activeId: tab.id,
})

export const activeTab = (state: WindowTabsState): WindowTab | null =>
  state.tabs.find((tab) => tab.id === state.activeId) ?? null

/**
 * The active tab follows navigation. A no-op when it already points there, so
 * an unrelated re-render never rewrites the strip.
 */
export function trackLocation(
  state: WindowTabsState,
  href: string,
  title: string
): WindowTabsState {
  const current = activeTab(state)
  if (current === null) return state
  if (current.href === href && current.title === title) return state
  return {
    ...state,
    tabs: state.tabs.map((tab) =>
      tab.id === state.activeId ? { ...tab, href, title } : tab
    ),
  }
}

/** Open a tab next to the active one, as every browser does, and go to it. */
export function openTab(
  state: WindowTabsState,
  tab: WindowTab
): WindowTabsState {
  const at = state.tabs.findIndex((existing) => existing.id === state.activeId)
  const tabs = [...state.tabs]
  tabs.splice(at < 0 ? tabs.length : at + 1, 0, tab)
  return { tabs, activeId: tab.id }
}

export function selectTab(state: WindowTabsState, id: string): WindowTabsState {
  if (id === state.activeId || !state.tabs.some((tab) => tab.id === id))
    return state
  return { ...state, activeId: id }
}

/**
 * Close a tab. Closing the active one hands the window to its right-hand
 * neighbour (the left-hand one at the end of the strip); closing the last tab
 * leaves it, since the window still has to show something.
 */
export function closeTab(state: WindowTabsState, id: string): WindowTabsState {
  if (state.tabs.length <= 1) return state
  const at = state.tabs.findIndex((tab) => tab.id === id)
  if (at < 0) return state
  const tabs = state.tabs.filter((tab) => tab.id !== id)
  if (id !== state.activeId) return { ...state, tabs }
  const next = tabs[Math.min(at, tabs.length - 1)]
  return { tabs, activeId: next.id }
}

/** Step `delta` tabs along the strip, wrapping at both ends. */
export function neighbourTab(
  state: WindowTabsState,
  delta: number
): WindowTab | null {
  const at = state.tabs.findIndex((tab) => tab.id === state.activeId)
  if (at < 0 || state.tabs.length === 0) return null
  const count = state.tabs.length
  return state.tabs[(((at + delta) % count) + count) % count] ?? null
}

const TITLES: ReadonlyArray<readonly [string, string]> = [
  ["/modes/code/browse", "Project"],
  ["/modes/code/commit", "Local changes"],
  ["/modes/code/review", "Pull requests"],
  ["/modes/code/comments", "Comments"],
  ["/modes/code/chats", "Chats"],
  ["/modes/code/docs", "Docs"],
  ["/modes/code/tasks", "Tasks"],
  ["/modes/collaboration", "Collaboration"],
  ["/inbox", "Inbox"],
  ["/settings", "Settings"],
]

export const HOME_HREF = "/modes/code/commit"

/** What a location calls itself in the strip. */
export function tabTitle(pathname: string): string {
  return (
    TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "Byconvo"
  )
}
