/**
 * `window-tabs` feature — the browser-style strip in the window's title bar.
 *
 * A window tab is a place in the app you are keeping open: a mode surface, a
 * chat, the inbox. Unlike the editor's file strip it is not scoped to a
 * repository and it carries no preview slot — every tab was opened on purpose,
 * and the only one that moves is the active one, which follows navigation the
 * way a browser tab follows the address bar.
 */

export interface WindowTab {
  /** Stable across navigation, so a tab keeps its slot as its href changes. */
  readonly id: string
  /** The location the tab shows — path plus search. */
  readonly href: string
  readonly title: string
}

export interface WindowTabsState {
  readonly tabs: ReadonlyArray<WindowTab>
  readonly activeId: string
}
