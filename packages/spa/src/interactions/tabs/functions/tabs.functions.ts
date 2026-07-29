import type { OpenIntent, Tab, TabsState } from "../interfaces/tabs.interfaces"

export const EMPTY_TABS: TabsState = { tabs: [], active: null }

const indexOf = (state: TabsState, path: string) =>
  state.tabs.findIndex((tab) => tab.path === path)

/**
 * Pinned tabs first, otherwise insertion order.
 *
 * WebStorm keeps pinned tabs at the head of the strip so they stay reachable
 * once it overflows — the whole point of pinning a file is not to lose it. The
 * sort is stable, so unpinning puts a tab back where it was rather than at the
 * end.
 */
export const orderTabs = (tabs: ReadonlyArray<Tab>): ReadonlyArray<Tab> => {
  const pinned = tabs.filter((tab) => tab.pinned)
  const loose = tabs.filter((tab) => !tab.pinned)
  return [...pinned, ...loose]
}

/**
 * Open `path`.
 *
 * A file already open is simply selected — reopening never duplicates a tab,
 * and never demotes one that has earned its slot. A file opened for a look
 * takes the preview slot, replacing whatever was previewed before. A file
 * opened to stay takes a slot of its own.
 */
export const openTab = (
  state: TabsState,
  path: string,
  intent: OpenIntent = "preview"
): TabsState => {
  const existing = indexOf(state, path)
  if (existing !== -1) {
    // Committing to a file already on screen promotes its tab in place.
    const tabs =
      intent === "permanent" && state.tabs[existing].preview
        ? state.tabs.map((tab) =>
            tab.path === path ? { ...tab, preview: false } : tab
          )
        : state.tabs
    return { tabs, active: path }
  }

  const opened: Tab = { path, pinned: false, preview: intent === "preview" }
  if (intent === "permanent") {
    return { tabs: [...state.tabs, opened], active: path }
  }

  // The preview slot is reused in place, so a run of single clicks walks the
  // tree without the strip growing.
  const previewAt = state.tabs.findIndex((tab) => tab.preview && !tab.pinned)
  if (previewAt === -1) {
    return { tabs: [...state.tabs, opened], active: path }
  }
  return {
    tabs: state.tabs.map((tab, index) => (index === previewAt ? opened : tab)),
    active: path,
  }
}

/**
 * Which tab to select once `closing` is gone: the one after it, or the one
 * before when it was last. Follows the strip's own order, so closing a pinned
 * tab lands on its pinned neighbour rather than wherever it sat originally.
 */
const successorOf = (state: TabsState, closing: string): string | null => {
  const ordered = orderTabs(state.tabs)
  const at = ordered.findIndex((tab) => tab.path === closing)
  if (at === -1) return state.active
  const next = ordered[at + 1] ?? ordered[at - 1]
  return next?.path ?? null
}

export const closeTab = (state: TabsState, path: string): TabsState => {
  const tabs = state.tabs.filter((tab) => tab.path !== path)
  if (tabs.length === state.tabs.length) return state
  // Closing a tab that was not on screen leaves the selection alone.
  const active = state.active === path ? successorOf(state, path) : state.active
  return { tabs, active }
}

/** Close everything but `path` — and the pinned tabs, which is what pinning is for. */
export const closeOthers = (state: TabsState, path: string): TabsState => {
  const tabs = state.tabs.filter((tab) => tab.path === path || tab.pinned)
  return { tabs, active: tabs.some((tab) => tab.path === path) ? path : null }
}

/** Close everything unpinned. */
export const closeAll = (state: TabsState): TabsState => {
  const tabs = state.tabs.filter((tab) => tab.pinned)
  const active =
    state.active !== null && tabs.some((tab) => tab.path === state.active)
      ? state.active
      : (tabs[0]?.path ?? null)
  return { tabs, active }
}

/**
 * Pin or unpin. Pinning also settles a preview tab: a file worth keeping is no
 * longer one the next click may replace.
 */
export const togglePin = (state: TabsState, path: string): TabsState => ({
  ...state,
  tabs: state.tabs.map((tab) =>
    tab.path === path
      ? { ...tab, pinned: !tab.pinned, preview: tab.pinned && tab.preview }
      : tab
  ),
})

/** Promote the preview tab to a permanent one, as an edit does. */
export const keepTab = (state: TabsState, path: string): TabsState => {
  const tab = state.tabs.find((entry) => entry.path === path)
  if (tab === undefined || !tab.preview) return state
  return {
    ...state,
    tabs: state.tabs.map((entry) =>
      entry.path === path ? { ...entry, preview: false } : entry
    ),
  }
}

/** The tab `delta` steps along the strip from the active one, wrapping. */
export const neighbourTab = (
  state: TabsState,
  delta: number
): string | null => {
  const ordered = orderTabs(state.tabs)
  if (ordered.length === 0) return null
  const at = ordered.findIndex((tab) => tab.path === state.active)
  if (at === -1) return ordered[0].path
  const next =
    (((at + delta) % ordered.length) + ordered.length) % ordered.length
  return ordered[next].path
}

/**
 * Reconcile the strip with the file the rest of the app says is open.
 *
 * Navigation does not all come through the strip — a jump from
 * go-to-definition, a restored URL, the command menu — so the strip follows the
 * open file rather than owning it.
 */
export const syncActive = (
  state: TabsState,
  path: string | null
): TabsState => {
  if (path === null)
    return state.active === null ? state : { ...state, active: null }
  if (state.active === path && indexOf(state, path) !== -1) return state
  return openTab(state, path)
}

/** Drop tabs for files that no longer exist, so a stale strip cannot outlive them. */
export const pruneTabs = (
  state: TabsState,
  exists: (path: string) => boolean
): TabsState => {
  const tabs = state.tabs.filter((tab) => exists(tab.path))
  if (tabs.length === state.tabs.length) return state
  const active =
    state.active !== null && tabs.some((tab) => tab.path === state.active)
      ? state.active
      : (tabs[0]?.path ?? null)
  return { tabs, active }
}
