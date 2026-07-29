/**
 * The open-file strip, held in a small localStorage-backed store.
 *
 * Which files you have open is view state, not navigation — the URL already
 * carries the one file on screen, and putting the whole strip in it would make
 * every tab click a history entry. It is per repository, since a strip of paths
 * from another checkout would be a list of files that do not exist.
 */
import { useSyncExternalStore } from "react"
import { EMPTY_TABS } from "../functions/tabs.functions"
import type { Tab, TabsState } from "../interfaces/tabs.interfaces"

const KEY_PREFIX = "byconvo-tabs:"

/** Which repository the strip in memory belongs to. */
let scope: string | null = null
let state: TabsState = EMPTY_TABS
const listeners = new Set<() => void>()

const keyFor = (repo: string) => `${KEY_PREFIX}${repo}`

const emit = () => {
  for (const listener of listeners) listener()
}

const isTab = (value: unknown): value is Tab =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Tab).path === "string"

const load = (repo: string): TabsState => {
  if (typeof window === "undefined") return EMPTY_TABS
  try {
    const raw = window.localStorage.getItem(keyFor(repo))
    if (raw === null) return EMPTY_TABS
    const parsed = JSON.parse(raw) as Partial<TabsState>
    const tabs = (parsed.tabs ?? []).filter(isTab).map((tab) => ({
      path: tab.path,
      pinned: tab.pinned === true,
      // A restored tab is never a preview: coming back to a strip is a
      // deliberate act, and the first click would otherwise throw one away.
      preview: false,
    }))
    const active =
      typeof parsed.active === "string" &&
      tabs.some((tab) => tab.path === parsed.active)
        ? parsed.active
        : null
    return { tabs, active }
  } catch {
    return EMPTY_TABS
  }
}

const persist = () => {
  if (typeof window === "undefined" || scope === null) return
  try {
    window.localStorage.setItem(keyFor(scope), JSON.stringify(state))
  } catch {
    // ignore quota errors
  }
}

/**
 * Point the store at a repository, loading its strip. Called as the shell
 * learns which repository is open; a no-op once it is pointed there.
 */
export const scopeTabsTo = (repo: string | null): void => {
  if (repo === scope) return
  scope = repo
  state = repo === null ? EMPTY_TABS : load(repo)
  emit()
}

/** Apply a transition from `tabs.functions`. */
export const updateTabs = (
  transition: (current: TabsState) => TabsState
): void => {
  const next = transition(state)
  if (next === state) return
  state = next
  persist()
  emit()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const snapshot = () => state

export const useTabs = (): TabsState =>
  useSyncExternalStore(subscribe, snapshot, snapshot)
