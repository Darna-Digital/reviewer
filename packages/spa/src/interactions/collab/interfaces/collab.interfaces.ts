/**
 * `collab` feature — the collaboration mode's writes, and the shapes its
 * surfaces are laid out from.
 *
 * The rules here are small but real: a project needs a name before it can be
 * made, a note is created and then written to rather than created with its
 * body, a star is a toggle rather than two buttons, and ticking a to-do off is
 * moving it to the last list as much as it is setting a flag. Each of them
 * would otherwise be spelled out inside a click handler, where it can only be
 * checked by rendering the page — so they live behind injected side effects
 * and are unit-tested against a mock.
 */
import type {
  CollabBookmark,
  CollabList,
  CollabNote,
  CollabProject,
  CollabTargetKind,
  CollabTodo,
} from "@byconvo/core/collab";

/** How wide the centred column runs on a given surface. */
export type CollabWidth = "narrow" | "wide";

/** The three shortcuts the hovering bar carries, and what the drawer shows. */
export type CollabPanel = "tasks" | "bookmarks" | "notes";

export interface CollabDependencies {
  data: Record<string, never>;
  sideEffects: {
    readonly createProject: (
      name: string,
      purpose: string
    ) => Promise<CollabProject>;
    readonly createTodo: (
      projectId: string,
      title: string,
      listId: string
    ) => Promise<CollabTodo>;
    readonly updateTodo: (
      id: string,
      patch: {
        readonly title?: string;
        readonly listId?: string;
        readonly done?: boolean;
        readonly assignee?: string;
        readonly dueOn?: string;
        readonly order?: number;
      }
    ) => Promise<CollabTodo>;
    readonly removeTodo: (id: string) => Promise<void>;
    readonly addList: (
      projectId: string,
      name: string
    ) => Promise<CollabProject>;
    readonly createNote: (
      title: string,
      projectId: string
    ) => Promise<CollabNote>;
    readonly saveNote: (id: string, content: string) => Promise<CollabNote>;
    readonly removeNote: (id: string) => Promise<void>;
    readonly addBookmark: (
      kind: CollabTargetKind,
      targetId: string,
      label: string
    ) => Promise<CollabBookmark>;
    readonly removeBookmark: (
      kind: CollabTargetKind,
      targetId: string
    ) => Promise<void>;
  };
}

export interface CollabFunctions {
  /** Create a project; null when the name is blank, which is a no-op. */
  readonly createProject: (
    name: string,
    purpose: string
  ) => Promise<CollabProject | null>;
  /** Add a to-do to a list; null when nothing was typed. */
  readonly createTodo: (
    projectId: string,
    title: string,
    listId: string
  ) => Promise<CollabTodo | null>;
  /**
   * Tick a to-do off, or un-tick it.
   *
   * Ticking also files it under the project's last list and un-ticking hands it
   * back to the first, because on a board those are the same act said twice —
   * a card left in "In progress" with a tick through it is a lie the column is
   * telling about itself.
   */
  readonly setDone: (
    todo: CollabTodo,
    done: boolean,
    lists: ReadonlyArray<CollabList>
  ) => Promise<CollabTodo>;
  /** Move a card to a list, at a given place in it. */
  readonly moveTodo: (
    todo: CollabTodo,
    listId: string,
    order: number
  ) => Promise<CollabTodo>;
  /** Rename a to-do; null when the new title is blank (the edit is refused). */
  readonly renameTodo: (
    todo: CollabTodo,
    title: string
  ) => Promise<CollabTodo | null>;
  readonly removeTodo: (id: string) => Promise<void>;
  /** Add a list to a project; null when the name is blank. */
  readonly addList: (
    projectId: string,
    name: string
  ) => Promise<CollabProject | null>;
  /**
   * Start a note. A blank title is allowed here where a blank project name is
   * not: a note is a doc, and a doc's title is something you arrive at by
   * writing it — the server names an untitled one rather than refusing it.
   */
  readonly createNote: (
    title: string,
    projectId: string
  ) => Promise<CollabNote>;
  readonly saveNote: (id: string, content: string) => Promise<CollabNote>;
  readonly removeNote: (id: string) => Promise<void>;
  /** The star, as the one thing it looks like: press it to change its state. */
  readonly toggleBookmark: (
    bookmarks: ReadonlyArray<CollabBookmark>,
    kind: CollabTargetKind,
    targetId: string,
    label: string
  ) => Promise<boolean>;
}
