/**
 * What storage has to be able to do, and nothing about how.
 *
 * The split follows the one the rest of core makes: this interface is the
 * writes and the reads a store must implement, and everything that can be
 * decided from values — a board's columns, a person's open work, whether a
 * thing is starred — is in `collab.functions` and computed above it by the
 * service. So the sqlite store and the in-memory one are the same handful of
 * row operations, and neither can quietly disagree about what a board is.
 */
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type {
  NoRepoSelected,
  NotFound,
  StorageError,
} from "../../../shared.ts";
import type {
  CollabBookmark,
  CollabNote,
  CollabProject,
  CollabTargetKind,
  CollabTodo,
} from "../schema/collab.schema.ts";

export interface CreateProjectInput {
  readonly name: string;
  readonly purpose: string;
  readonly color?: string;
}

export interface UpdateProjectInput {
  readonly name?: string;
  readonly purpose?: string;
  readonly color?: string;
  readonly archived?: boolean;
}

export interface UpdateListInput {
  readonly name?: string;
  readonly color?: string;
}

export interface CreateTodoInput {
  readonly title: string;
  readonly listId?: string;
  readonly notes?: string;
  readonly assignee?: string;
  readonly dueOn?: string;
}

export interface UpdateTodoInput {
  readonly title?: string;
  readonly notes?: string;
  readonly listId?: string;
  readonly assignee?: string;
  readonly dueOn?: string;
  readonly done?: boolean;
  readonly order?: number;
}

export interface CreateNoteInput {
  readonly title: string;
  readonly projectId: string;
  readonly content: string;
}

export interface UpdateNoteInput {
  readonly title?: string;
  readonly content?: string;
}

export type CollabFailure = NoRepoSelected | NotFound | StorageError;

export interface CollabRepo {
  readonly projects: Effect.Effect<ReadonlyArray<CollabProject>, CollabFailure>;
  readonly project: (id: string) => Effect.Effect<CollabProject, CollabFailure>;
  readonly createProject: (
    input: CreateProjectInput
  ) => Effect.Effect<CollabProject, CollabFailure>;
  readonly updateProject: (
    id: string,
    input: UpdateProjectInput
  ) => Effect.Effect<CollabProject, CollabFailure>;
  /** Takes the project's todos and notes with it — nothing is left orphaned. */
  readonly removeProject: (id: string) => Effect.Effect<void, CollabFailure>;

  readonly addList: (
    projectId: string,
    name: string
  ) => Effect.Effect<CollabProject, CollabFailure>;
  readonly updateList: (
    projectId: string,
    listId: string,
    input: UpdateListInput
  ) => Effect.Effect<CollabProject, CollabFailure>;
  /** Cards standing in the removed list fall back to the first one. */
  readonly removeList: (
    projectId: string,
    listId: string
  ) => Effect.Effect<CollabProject, CollabFailure>;

  readonly todos: Effect.Effect<ReadonlyArray<CollabTodo>, CollabFailure>;
  readonly createTodo: (
    projectId: string,
    input: CreateTodoInput
  ) => Effect.Effect<CollabTodo, CollabFailure>;
  readonly updateTodo: (
    id: string,
    input: UpdateTodoInput
  ) => Effect.Effect<CollabTodo, CollabFailure>;
  readonly removeTodo: (id: string) => Effect.Effect<void, CollabFailure>;

  readonly notes: Effect.Effect<ReadonlyArray<CollabNote>, CollabFailure>;
  readonly note: (id: string) => Effect.Effect<CollabNote, CollabFailure>;
  readonly createNote: (
    input: CreateNoteInput
  ) => Effect.Effect<CollabNote, CollabFailure>;
  readonly updateNote: (
    id: string,
    input: UpdateNoteInput
  ) => Effect.Effect<CollabNote, CollabFailure>;
  readonly removeNote: (id: string) => Effect.Effect<void, CollabFailure>;

  readonly bookmarks: Effect.Effect<
    ReadonlyArray<CollabBookmark>,
    CollabFailure
  >;
  readonly addBookmark: (
    kind: CollabTargetKind,
    targetId: string,
    label: string
  ) => Effect.Effect<CollabBookmark, CollabFailure>;
  /** By what it points at rather than by its own id: the caller has a star,
   * not a row. */
  readonly removeBookmark: (
    kind: CollabTargetKind,
    targetId: string
  ) => Effect.Effect<void, CollabFailure>;
}

export class CollabRepository extends Context.Service<
  CollabRepository,
  CollabRepo
>()("CollabRepository") {}
