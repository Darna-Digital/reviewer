/**
 * The collaboration service — the repository, plus the four questions a page
 * actually asks.
 *
 * Every one of them is a grouping over rows the store already hands back, so
 * none of them is a query: `detail` is a project with its own work beside it,
 * `board` is that work dealt into the project's lists, `mine` is one person's
 * slice of everything, and `home` is the list of projects with a count under
 * each. Computing them here rather than in the store is what lets the
 * in-memory and sqlite stores stay the same handful of row operations — and
 * what makes the answers testable against a store that is an array.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import {
  CollabRepository,
  type CollabFailure,
  type CollabRepo,
} from "../repository/collab.repository.ts";
import type {
  CollabBoardColumn,
  CollabMine,
  CollabProjectDetail,
  CollabProjectSummary,
} from "../schema/collab.schema.ts";
import {
  board,
  dedupeBookmarks,
  listedProjects,
  myNotes,
  myTodos,
  projectProgress,
  recentNotes,
  sortedTodos,
} from "../functions/collab.functions.ts";

export interface CollabServiceShape extends CollabRepo {
  /** The projects home: every project, with how far through its work it is. */
  readonly home: Effect.Effect<
    ReadonlyArray<CollabProjectSummary>,
    CollabFailure
  >;
  readonly detail: (
    id: string
  ) => Effect.Effect<CollabProjectDetail, CollabFailure>;
  readonly board: (
    id: string
  ) => Effect.Effect<ReadonlyArray<CollabBoardColumn>, CollabFailure>;
  /** What the bottom bar's drawer shows, for one viewer. */
  readonly mine: (viewer: string) => Effect.Effect<CollabMine, CollabFailure>;
}

export class CollabService extends Context.Service<
  CollabService,
  CollabServiceShape
>()("CollabService") {}

export const makeCollabService = Effect.gen(function* () {
  const repo = yield* CollabRepository;

  const home: CollabServiceShape["home"] = Effect.map(
    Effect.all([repo.projects, repo.todos]),
    ([projects, todos]) =>
      listedProjects(projects).map((project) => ({
        project,
        progress: projectProgress(
          todos.filter((todo) => todo.projectId === project.id)
        ),
      }))
  );

  const detail: CollabServiceShape["detail"] = (id) =>
    Effect.map(
      Effect.all([repo.project(id), repo.todos, repo.notes]),
      ([project, todos, notes]) => ({
        project,
        todos: sortedTodos(todos.filter((todo) => todo.projectId === id)),
        notes: recentNotes(notes.filter((note) => note.projectId === id)),
      })
    );

  const columns: CollabServiceShape["board"] = (id) =>
    Effect.map(Effect.all([repo.project(id), repo.todos]), ([project, todos]) =>
      board(project, todos)
    );

  const mine: CollabServiceShape["mine"] = (viewer) =>
    Effect.map(
      Effect.all([repo.todos, repo.notes, repo.bookmarks]),
      ([todos, notes, bookmarks]) => ({
        todos: myTodos(todos, viewer),
        notes: myNotes(notes),
        bookmarks: dedupeBookmarks(bookmarks),
      })
    );

  return CollabService.of({ ...repo, home, detail, board: columns, mine });
});
