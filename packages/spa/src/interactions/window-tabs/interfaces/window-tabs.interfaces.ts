/**
 * `window-tabs` feature — the browser-style strip in the window's title bar.
 *
 * The strip leads with three pinned tabs: Code, which follows the git surfaces
 * the way a browser tab follows the address bar, Collaboration, and Sessions,
 * the agent conversations. None of them closes, so the window always has
 * somewhere to be. Behind them sit the session tabs `+` opens — one chat each,
 * closable and reorderable, and unlike the editor's file strip never a preview
 * slot.
 */

export type WindowTabKind =
  | "project"
  | "collaboration"
  | "sessions"
  | "session";

export interface WindowTab {
  /** Stable across navigation, so a tab keeps its slot as its href changes. */
  readonly id: string;
  /** The location the tab shows — path plus search. */
  readonly href: string;
  readonly title: string;
  readonly kind: WindowTabKind;
}

export interface WindowTabsState {
  readonly tabs: ReadonlyArray<WindowTab>;
  readonly activeId: string;
}
