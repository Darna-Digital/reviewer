/**
 * The collaboration rules, as functions over values.
 *
 * Everything a repository would otherwise have to decide inline lives here:
 * where a new card lands, what a board looks like once its cards are dealt into
 * its lists, which todos are a person's, and what a bookmark is called. None of
 * it touches storage, so the interesting half of the feature is testable
 * without a database — which is the point, because the interesting half is
 * ordering and grouping and those are exactly what a sqlite-backed test would
 * hide behind an `ORDER BY`.
 */
import {
  DEFAULT_LISTS,
  LIST_COLORS,
  type CollabBoardColumn,
  type CollabBookmark,
  type CollabList,
  type CollabNote,
  type CollabProject,
  type CollabTargetKind,
  type CollabTodo,
} from "../schema/collab.schema.ts";

/** Lists in the order a project holds them, without mutating the array given. */
export const sortedLists = (
  lists: ReadonlyArray<CollabList>
): ReadonlyArray<CollabList> => [...lists].sort((a, b) => a.order - b.order);

/**
 * A project's lists, guaranteed to be at least one.
 *
 * A project stored before this field existed, or one whose last list was
 * deleted by a client that should not have been able to, still has to be
 * drawable — so the defaults stand in rather than the page being empty.
 */
export const projectLists = (
  project: CollabProject
): ReadonlyArray<CollabList> =>
  project.lists.length > 0 ? sortedLists(project.lists) : DEFAULT_LISTS;

/** The list a todo lands in when none was named: the leftmost one. */
export const firstListId = (project: CollabProject): string =>
  projectLists(project)[0]?.id ?? DEFAULT_LISTS[0].id;

/**
 * The list a todo actually belongs to. A card pointed at a list that has since
 * been deleted is shown in the first one rather than dropped: it is still work
 * somebody wrote down, and a board that silently loses cards is worse than one
 * that puts a card back where it can be seen.
 */
export const resolveListId = (
  project: CollabProject,
  listId: string
): string =>
  projectLists(project).some((list) => list.id === listId)
    ? listId
    : firstListId(project);

/** Where the next card in a list goes: after the last one standing in it. */
export const nextOrder = (
  todos: ReadonlyArray<CollabTodo>,
  listId: string
): number =>
  todos
    .filter((todo) => todo.listId === listId)
    .reduce((max, todo) => Math.max(max, todo.order), 0) + 1;

/** Cards in the order a list reads them. */
export const sortedTodos = (
  todos: ReadonlyArray<CollabTodo>
): ReadonlyArray<CollabTodo> =>
  [...todos].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

/**
 * The board: every list of the project, each holding the cards that point at
 * it, in card order.
 *
 * Lists are the outer loop rather than the cards, so an empty list is a column
 * you can drop into instead of a column that is not there — which is the whole
 * difference between a board and a list of lists.
 */
export const board = (
  project: CollabProject,
  todos: ReadonlyArray<CollabTodo>
): ReadonlyArray<CollabBoardColumn> => {
  const ordered = sortedTodos(
    todos.filter((todo) => todo.projectId === project.id)
  );
  return projectLists(project).map((list) => ({
    list,
    todos: ordered.filter(
      (todo) => resolveListId(project, todo.listId) === list.id
    ),
  }));
};

/**
 * The order "My tasks" reads in: dated work before undated, soonest first, and
 * whatever is left in the order its list holds it.
 *
 * A date is the only thing here that is a claim about the outside world, so it
 * sorts ahead of everything that is only a claim about a list.
 */
export const byDueThenOrder = (a: CollabTodo, b: CollabTodo): number => {
  const aDated = a.dueOn.length > 0;
  const bDated = b.dueOn.length > 0;
  if (aDated !== bDated) return aDated ? -1 : 1;
  if (aDated && bDated && a.dueOn !== b.dueOn) {
    return a.dueOn < b.dueOn ? -1 : 1;
  }
  return a.order - b.order || a.id.localeCompare(b.id);
};

/**
 * The open work assigned to one person.
 *
 * Case- and space-insensitive on the name, because the assignee is free text
 * until byconvo has accounts and "Rūtenis" typed twice is two strings more
 * often than it is two people. A blank viewer asks for the unassigned pile —
 * Basecamp's "up for grabs" — rather than for everything.
 */
export const myTodos = (
  todos: ReadonlyArray<CollabTodo>,
  viewer: string
): ReadonlyArray<CollabTodo> => {
  const wanted = viewer.trim().toLowerCase();
  return todos
    .filter(
      (todo) => !todo.done && todo.assignee.trim().toLowerCase() === wanted
    )
    .sort(byDueThenOrder);
};

/** Notes newest-written first, which is the order a list of them is read in. */
export const recentNotes = (
  notes: ReadonlyArray<CollabNote>
): ReadonlyArray<CollabNote> =>
  [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

/**
 * Personal notes ahead of project ones, each half newest first.
 *
 * "My notes" is where a thought goes before it belongs to a project, so the
 * unfiled ones lead — the drawer is a scratchpad first and an index second.
 */
export const myNotes = (
  notes: ReadonlyArray<CollabNote>
): ReadonlyArray<CollabNote> => {
  const own = recentNotes(notes.filter((note) => note.projectId.length === 0));
  const filed = recentNotes(notes.filter((note) => note.projectId.length > 0));
  return [...own, ...filed];
};

/** What identifies the thing a bookmark points at, for comparing two of them. */
export const bookmarkKey = (kind: CollabTargetKind, targetId: string): string =>
  `${kind}:${targetId}`;

export const isBookmarked = (
  bookmarks: ReadonlyArray<CollabBookmark>,
  kind: CollabTargetKind,
  targetId: string
): boolean =>
  bookmarks.some(
    (bookmark) =>
      bookmarkKey(bookmark.kind, bookmark.targetId) ===
      bookmarkKey(kind, targetId)
  );

/**
 * Bookmarks newest first, and one per thing.
 *
 * The star is a toggle, so a second one is a bug rather than a choice; folding
 * duplicates on read means a client that double-fired never shows the same
 * project twice, and the extra row is cleaned up by the next un-star.
 */
export const dedupeBookmarks = (
  bookmarks: ReadonlyArray<CollabBookmark>
): ReadonlyArray<CollabBookmark> => {
  const seen = new Set<string>();
  const kept: CollabBookmark[] = [];
  for (const bookmark of [...bookmarks].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  )) {
    const key = bookmarkKey(bookmark.kind, bookmark.targetId);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(bookmark);
  }
  return kept;
};

/** A name with the whitespace taken off, or the fallback if nothing is left. */
export const named = (value: string, fallback: string): string => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

/**
 * The palette a new project's mark is taken from, walked in order.
 *
 * In order rather than at random: a person making three projects in a row gets
 * three colours they can tell apart, which random selection only manages most
 * of the time.
 */
export const PROJECT_COLORS: ReadonlyArray<string> = [
  "#f97316",
  "#2563eb",
  "#16a34a",
  "#db2777",
  "#7c3aed",
  "#0891b2",
];

export const nextProjectColor = (
  existing: ReadonlyArray<CollabProject>
): string => PROJECT_COLORS[existing.length % PROJECT_COLORS.length];

/** The same walk, for the column a project is about to gain. */
export const nextListColor = (existing: ReadonlyArray<CollabList>): string =>
  LIST_COLORS[existing.length % LIST_COLORS.length];

/**
 * Projects as the home page lists them: live ones first, newest first within
 * each half, so archiving a project moves it down rather than hiding it.
 */
export const listedProjects = (
  projects: ReadonlyArray<CollabProject>
): ReadonlyArray<CollabProject> =>
  [...projects].sort(
    (a, b) =>
      Number(a.archived) - Number(b.archived) ||
      b.createdAt.localeCompare(a.createdAt)
  );

/** How far through a project's work is, as a count rather than a percentage. */
export const projectProgress = (
  todos: ReadonlyArray<CollabTodo>
): { readonly done: number; readonly total: number } => ({
  done: todos.filter((todo) => todo.done).length,
  total: todos.length,
});
