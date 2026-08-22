/**
 * The collaboration domain — a project, the work under it, and the things a
 * person keeps.
 *
 * Basecamp's shape, in four nouns. A **project** is a place people work
 * together; it carries its own **lists**, which are both the to-do lists the
 * narrow layout reads down and the columns the board reads across — one
 * grouping, drawn two ways, so moving a card on the board is the same write as
 * ticking it off in a list. A **todo** belongs to exactly one of them. A
 * **note** is a doc: id, title, markdown, last written — the same four fields
 * `docs` has, because that is what a note is once the UI is taken off it. A
 * **bookmark** is a pointer at any of the three, so the bottom bar's drawer can
 * be a single list rather than three lists that happen to be shown together.
 *
 * Ids are opaque strings the repository mints. Ordering is an explicit number
 * rather than array position: a board hands one card a new place without
 * rewriting the rest, and two clients that disagree still converge on a total
 * order.
 */
import * as Schema from "effect/Schema";

/** What a bookmark can point at. */
export const CollabTargetKind = Schema.Literals(["project", "todo", "note"]);
export type CollabTargetKind = typeof CollabTargetKind.Type;

/**
 * A to-do list inside a project — a column when the same project is read as a
 * board. Held on the project rather than in a table of its own: a list has no
 * life apart from the project it groups, and reading a project should not be
 * two queries.
 */
export const CollabList = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  order: Schema.Number,
  /**
   * The column's own hue on the board.
   *
   * A list carries it rather than the board computing one from position,
   * because position is the one thing about a column that changes: a colour
   * derived from index would repaint half the board every time a column moved,
   * and the colour is how you find your column again after it has.
   */
  color: Schema.String,
});
export type CollabList = typeof CollabList.Type;

/**
 * The hues a board's columns are dealt from, walked in order — the same
 * reasoning as `PROJECT_COLORS` in `collab.functions`, which is where the
 * dealing happens.
 */
export const LIST_COLORS: ReadonlyArray<string> = [
  "#8b5cf6",
  "#ef4444",
  "#f59e0b",
  "#eab308",
  "#22c55e",
  "#06b6d4",
];

/** What a project starts with, so a new one is usable before it is configured. */
export const DEFAULT_LISTS: ReadonlyArray<CollabList> = [
  { id: "todo", name: "To do", order: 0, color: LIST_COLORS[0] },
  { id: "doing", name: "In progress", order: 1, color: LIST_COLORS[2] },
  { id: "done", name: "Done", order: 2, color: LIST_COLORS[4] },
];

export const CollabProject = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  /** Basecamp's "what's this project about?" — one line, shown under the name. */
  purpose: Schema.String,
  /** A CSS colour, drawn as the project's mark wherever it is listed. */
  color: Schema.String,
  lists: Schema.Array(CollabList),
  archived: Schema.Boolean,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
export type CollabProject = typeof CollabProject.Type;

export const CollabTodo = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  listId: Schema.String,
  title: Schema.String,
  notes: Schema.String,
  /** Who it is on. Empty means nobody has taken it — Basecamp's unassigned. */
  assignee: Schema.String,
  done: Schema.Boolean,
  /** ISO date (`YYYY-MM-DD`), or empty for no date. */
  dueOn: Schema.String,
  order: Schema.Number,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
export type CollabTodo = typeof CollabTodo.Type;

/**
 * A note. `projectId` empty means it is the person's own rather than a
 * project's — which is what "My notes" in the bottom bar lists first.
 */
export const CollabNote = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  title: Schema.String,
  content: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
export type CollabNote = typeof CollabNote.Type;

export const CollabBookmark = Schema.Struct({
  id: Schema.String,
  kind: CollabTargetKind,
  targetId: Schema.String,
  /** Denormalised so a bookmark still reads as something after its target goes. */
  label: Schema.String,
  createdAt: Schema.String,
});
export type CollabBookmark = typeof CollabBookmark.Type;

/**
 * A project with everything under it — what one page of the app needs, in one
 * round trip. The lists come off the project; the todos are separated out
 * because that is the row the board moves.
 */
export const CollabProjectDetail = Schema.Struct({
  project: CollabProject,
  todos: Schema.Array(CollabTodo),
  notes: Schema.Array(CollabNote),
});
export type CollabProjectDetail = typeof CollabProjectDetail.Type;

/**
 * A project as the home page lists it: the project, and how far through its
 * work it is. The count rides with the project so the page is one request
 * rather than one per card it draws.
 */
export const CollabProjectSummary = Schema.Struct({
  project: CollabProject,
  progress: Schema.Struct({
    done: Schema.Number,
    total: Schema.Number,
  }),
});
export type CollabProjectSummary = typeof CollabProjectSummary.Type;

/** One board column, resolved: the list, and the cards standing in it. */
export const CollabBoardColumn = Schema.Struct({
  list: CollabList,
  todos: Schema.Array(CollabTodo),
});
export type CollabBoardColumn = typeof CollabBoardColumn.Type;

/**
 * Everything the bottom bar's drawer shows, for one viewer.
 *
 * One payload rather than three, because the three panels are one question —
 * "what is mine?" — and answering it three times would let the drawer show a
 * task list from one moment beside a bookmark list from another.
 */
export const CollabMine = Schema.Struct({
  todos: Schema.Array(CollabTodo),
  notes: Schema.Array(CollabNote),
  bookmarks: Schema.Array(CollabBookmark),
});
export type CollabMine = typeof CollabMine.Type;

// --- Payloads ---------------------------------------------------------------

export const NewCollabProject = Schema.Struct({
  name: Schema.String,
  purpose: Schema.optionalKey(Schema.String),
  color: Schema.optionalKey(Schema.String),
});
export type NewCollabProject = typeof NewCollabProject.Type;

export const UpdateCollabProject = Schema.Struct({
  name: Schema.optionalKey(Schema.String),
  purpose: Schema.optionalKey(Schema.String),
  color: Schema.optionalKey(Schema.String),
  archived: Schema.optionalKey(Schema.Boolean),
});
export type UpdateCollabProject = typeof UpdateCollabProject.Type;

export const NewCollabList = Schema.Struct({ name: Schema.String });
export type NewCollabList = typeof NewCollabList.Type;

export const UpdateCollabList = Schema.Struct({
  name: Schema.optionalKey(Schema.String),
  color: Schema.optionalKey(Schema.String),
});
export type UpdateCollabList = typeof UpdateCollabList.Type;

export const NewCollabTodo = Schema.Struct({
  title: Schema.String,
  listId: Schema.optionalKey(Schema.String),
  notes: Schema.optionalKey(Schema.String),
  assignee: Schema.optionalKey(Schema.String),
  dueOn: Schema.optionalKey(Schema.String),
});
export type NewCollabTodo = typeof NewCollabTodo.Type;

export const UpdateCollabTodo = Schema.Struct({
  title: Schema.optionalKey(Schema.String),
  notes: Schema.optionalKey(Schema.String),
  listId: Schema.optionalKey(Schema.String),
  assignee: Schema.optionalKey(Schema.String),
  dueOn: Schema.optionalKey(Schema.String),
  done: Schema.optionalKey(Schema.Boolean),
  order: Schema.optionalKey(Schema.Number),
});
export type UpdateCollabTodo = typeof UpdateCollabTodo.Type;

export const NewCollabNote = Schema.Struct({
  title: Schema.String,
  projectId: Schema.optionalKey(Schema.String),
  content: Schema.optionalKey(Schema.String),
});
export type NewCollabNote = typeof NewCollabNote.Type;

export const UpdateCollabNote = Schema.Struct({
  title: Schema.optionalKey(Schema.String),
  content: Schema.optionalKey(Schema.String),
});
export type UpdateCollabNote = typeof UpdateCollabNote.Type;

export const NewCollabBookmark = Schema.Struct({
  kind: CollabTargetKind,
  targetId: Schema.String,
  label: Schema.optionalKey(Schema.String),
});
export type NewCollabBookmark = typeof NewCollabBookmark.Type;

/** Who is asking. The drawer is per-person, and byconvo has no accounts yet. */
export const ViewerQuery = Schema.Struct({
  viewer: Schema.optionalKey(Schema.String),
});
export type ViewerQuery = typeof ViewerQuery.Type;

export const CollabIdParam = Schema.Struct({ id: Schema.String });
export const CollabProjectListParams = Schema.Struct({
  id: Schema.String,
  listId: Schema.String,
});
