/**
 * `collaboration-tabs` feature — the strip of open surfaces in collaboration
 * mode, standing where code mode keeps its open files.
 *
 * A tab holds one surface the sidebar can reach — a project, its tasks, a task,
 * a chat, the docs, the people, the inbox — and follows navigation
 * the way a browser tab follows its address bar, so moving around replaces the
 * active tab rather than piling up new ones. `+` is what opens another.
 */
import type { CollaborationView } from "@/interactions/collaboration/data/collaboration.mock";

/** The inbox is a route of its own rather than a `view`, so it joins here. */
export type CollaborationTabKind = CollaborationView | "inbox";

/** A surface, as the strip knows it: what kind it is, of what, and its name. */
export interface CollaborationPlace {
  readonly kind: CollaborationTabKind;
  /** The project, task or chat on show; empty where a kind is one of a kind,
   * as the inbox is. */
  readonly subject: string;
  readonly title: string;
}

export interface CollaborationTab extends CollaborationPlace {
  /** Stable across navigation, so a tab keeps its slot as its href changes. */
  readonly id: string;
  /** The location the tab shows — path plus search. */
  readonly href: string;
}

export interface CollaborationTabsState {
  readonly tabs: ReadonlyArray<CollaborationTab>;
  readonly activeId: string;
}
