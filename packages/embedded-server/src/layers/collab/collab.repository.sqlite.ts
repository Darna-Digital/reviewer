/**
 * The collaboration store, in SQLite.
 *
 * It is the memory store's twin, and deliberately so: the same shared functions
 * decide where a card lands, what happens to the cards in a deleted list and
 * whether a star already exists, so the two cannot drift into disagreeing about
 * what a board is. What differs is only what a store has to differ about —
 * rows, ids that stay unique across process restarts, and real timestamps.
 *
 * Projects and todos are `documentTable`s over the tables the migration
 * declares; the two writes that touch more than one row — deleting a project,
 * emptying a list — go through `transact`, so a reader never sees a project
 * whose todos are half gone.
 */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { NotFound, StorageError } from "@byconvo/core/shared";
import {
  CollabBookmark,
  CollabNote,
  CollabProject,
  CollabTodo,
  DEFAULT_LISTS,
  bookmarkKey,
  named,
  nextListColor,
  nextOrder,
  nextProjectColor,
  projectLists,
  resolveListId,
  sortedLists,
  type CollabList,
  type CollabRepo,
  type CollabTargetKind,
  type CreateNoteInput,
  type CreateProjectInput,
  type CreateTodoInput,
  type UpdateListInput,
  type UpdateNoteInput,
  type UpdateProjectInput,
  type UpdateTodoInput,
} from "@byconvo/core/collab";
import { allRows, execute, transact } from "../db/database.ts";
import { inRepo } from "../db/db.service.ts";
import { documentTable } from "../db/documents.ts";
import { WorkspaceContext } from "../workspace/workspace-context.ts";

const projects = documentTable<CollabProject>({
  table: "collab_project",
  sortColumn: "created_at",
  direction: "desc",
  decode: Schema.decodeUnknownSync(CollabProject),
});

const bookmarks = documentTable<CollabBookmark>({
  table: "collab_bookmark",
  sortColumn: "created_at",
  direction: "desc",
  decode: Schema.decodeUnknownSync(CollabBookmark),
});

/**
 * Todos and notes carry a `project_id` column the shared helper does not know
 * about, so their writes are spelled out here. The reads are the helper's
 * shape, including its rule that one row written by an older schema drops out
 * of a list rather than taking the list down with it.
 */
const decodeTodo = Schema.decodeUnknownSync(CollabTodo);
const decodeNote = Schema.decodeUnknownSync(CollabNote);

const readable =
  <A>(decode: (input: unknown) => A) =>
  (row: { readonly data: string }): ReadonlyArray<A> => {
    try {
      return [decode(JSON.parse(row.data))];
    } catch {
      return [];
    }
  };

const readTodos = (repoPath: string): ReadonlyArray<CollabTodo> =>
  allRows<{ data: string }>(
    "SELECT data FROM collab_todo WHERE repo_path = ? ORDER BY created_at, id",
    repoPath
  ).flatMap(readable(decodeTodo));

const readNotes = (repoPath: string): ReadonlyArray<CollabNote> =>
  allRows<{ data: string }>(
    "SELECT data FROM collab_note WHERE repo_path = ? ORDER BY updated_at DESC, id",
    repoPath
  ).flatMap(readable(decodeNote));

const writeTodo = (repoPath: string, todo: CollabTodo): void => {
  execute(
    `INSERT INTO collab_todo (id, repo_path, project_id, created_at, data)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       repo_path = excluded.repo_path,
       project_id = excluded.project_id,
       created_at = excluded.created_at,
       data = excluded.data`,
    todo.id,
    repoPath,
    todo.projectId,
    todo.createdAt,
    JSON.stringify(todo)
  );
};

const writeNote = (repoPath: string, note: CollabNote): void => {
  execute(
    `INSERT INTO collab_note (id, repo_path, project_id, updated_at, data)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       repo_path = excluded.repo_path,
       project_id = excluded.project_id,
       updated_at = excluded.updated_at,
       data = excluded.data`,
    note.id,
    repoPath,
    note.projectId,
    note.updatedAt,
    JSON.stringify(note)
  );
};

// Module-scoped so ids stay unique across the per-request repositories — the
// same reason the plans store keeps one.
let counter = 0;
const mint = (prefix: string): string => {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
};

export const makeSqliteCollabRepository = Effect.gen(function* () {
  const ctx = yield* WorkspaceContext;
  const withRepo = inRepo(ctx);
  const now = () => new Date().toISOString();

  const requireProject = (repoPath: string, id: string): CollabProject => {
    const project = projects.find(repoPath, id);
    if (project === undefined) {
      throw new NotFound({ reason: `project ${id} not found` });
    }
    return project;
  };

  const requireTodo = (repoPath: string, id: string): CollabTodo => {
    const todo = readTodos(repoPath).find((candidate) => candidate.id === id);
    if (todo === undefined) {
      throw new NotFound({ reason: `todo ${id} not found` });
    }
    return todo;
  };

  const requireNote = (repoPath: string, id: string): CollabNote => {
    const note = readNotes(repoPath).find((candidate) => candidate.id === id);
    if (note === undefined) {
      throw new NotFound({ reason: `note ${id} not found` });
    }
    return note;
  };

  /** Save a project and hand it back — every list write ends this way. */
  const putProject = (repoPath: string, project: CollabProject) => {
    projects.put(repoPath, project.id, project.createdAt, project);
    return project;
  };

  const repo: CollabRepo = {
    projects: withRepo((repoPath) => projects.list(repoPath)),

    project: (id) => withRepo((repoPath) => requireProject(repoPath, id)),

    createProject: (input: CreateProjectInput) =>
      withRepo((repoPath) => {
        const stamp = now();
        const project: CollabProject = {
          id: mint("project"),
          name: named(input.name, "Untitled project"),
          purpose: input.purpose.trim(),
          color: input.color ?? nextProjectColor(projects.list(repoPath)),
          lists: DEFAULT_LISTS,
          archived: false,
          createdAt: stamp,
          updatedAt: stamp,
        };
        return putProject(repoPath, project);
      }),

    updateProject: (id, input: UpdateProjectInput) =>
      withRepo((repoPath) => {
        const project = requireProject(repoPath, id);
        return putProject(repoPath, {
          ...project,
          name:
            input.name === undefined
              ? project.name
              : named(input.name, project.name),
          purpose: input.purpose?.trim() ?? project.purpose,
          color: input.color ?? project.color,
          archived: input.archived ?? project.archived,
          updatedAt: now(),
        });
      }),

    removeProject: (id) =>
      withRepo((repoPath) => {
        // One transaction: a project without its work, or work without its
        // project, is not a state any reader should be able to catch.
        transact(() => {
          projects.remove(repoPath, id);
          execute(
            "DELETE FROM collab_todo WHERE repo_path = ? AND project_id = ?",
            repoPath,
            id
          );
          execute(
            "DELETE FROM collab_note WHERE repo_path = ? AND project_id = ?",
            repoPath,
            id
          );
        });
      }),

    addList: (projectId, name) =>
      withRepo((repoPath) => {
        const project = requireProject(repoPath, projectId);
        const lists = projectLists(project);
        const list: CollabList = {
          id: mint("list"),
          name: named(name, "New list"),
          order: lists.reduce((max, l) => Math.max(max, l.order), -1) + 1,
          color: nextListColor(lists),
        };
        return putProject(repoPath, {
          ...project,
          lists: [...lists, list],
          updatedAt: now(),
        });
      }),

    updateList: (projectId, listId, input: UpdateListInput) =>
      withRepo((repoPath) => {
        const project = requireProject(repoPath, projectId);
        const lists = projectLists(project);
        if (!lists.some((list) => list.id === listId)) {
          throw new NotFound({ reason: `list ${listId} not found` });
        }
        return putProject(repoPath, {
          ...project,
          lists: lists.map((list) =>
            list.id === listId
              ? {
                  ...list,
                  name:
                    input.name === undefined
                      ? list.name
                      : named(input.name, list.name),
                  color: input.color ?? list.color,
                }
              : list
          ),
          updatedAt: now(),
        });
      }),

    removeList: (projectId, listId) =>
      withRepo((repoPath) => {
        const project = requireProject(repoPath, projectId);
        const lists = projectLists(project);
        if (lists.length <= 1) {
          throw new StorageError({
            reason: "a project needs at least one list",
          });
        }
        const remaining = sortedLists(
          lists.filter((list) => list.id !== listId)
        );
        const fallback = remaining[0].id;
        const stamp = now();
        return transact(() => {
          for (const todo of readTodos(repoPath)) {
            if (todo.projectId !== projectId || todo.listId !== listId)
              continue;
            writeTodo(repoPath, {
              ...todo,
              listId: fallback,
              updatedAt: stamp,
            });
          }
          return putProject(repoPath, {
            ...project,
            lists: remaining,
            updatedAt: stamp,
          });
        });
      }),

    todos: withRepo((repoPath) => readTodos(repoPath)),

    createTodo: (projectId, input: CreateTodoInput) =>
      withRepo((repoPath) => {
        const project = requireProject(repoPath, projectId);
        const listId = resolveListId(
          project,
          input.listId ?? projectLists(project)[0].id
        );
        const stamp = now();
        const todo: CollabTodo = {
          id: mint("todo"),
          projectId,
          listId,
          title: named(input.title, "Untitled to-do"),
          notes: input.notes?.trim() ?? "",
          assignee: input.assignee?.trim() ?? "",
          done: false,
          dueOn: input.dueOn?.trim() ?? "",
          order: nextOrder(
            readTodos(repoPath).filter((t) => t.projectId === projectId),
            listId
          ),
          createdAt: stamp,
          updatedAt: stamp,
        };
        writeTodo(repoPath, todo);
        return todo;
      }),

    updateTodo: (id, input: UpdateTodoInput) =>
      withRepo((repoPath) => {
        const existing = requireTodo(repoPath, id);
        const project = requireProject(repoPath, existing.projectId);
        const next: CollabTodo = {
          ...existing,
          title:
            input.title === undefined
              ? existing.title
              : named(input.title, existing.title),
          notes: input.notes?.trim() ?? existing.notes,
          listId:
            input.listId === undefined
              ? existing.listId
              : resolveListId(project, input.listId),
          assignee: input.assignee?.trim() ?? existing.assignee,
          dueOn: input.dueOn?.trim() ?? existing.dueOn,
          done: input.done ?? existing.done,
          order: input.order ?? existing.order,
          updatedAt: now(),
        };
        writeTodo(repoPath, next);
        return next;
      }),

    removeTodo: (id) =>
      withRepo((repoPath) => {
        execute(
          "DELETE FROM collab_todo WHERE repo_path = ? AND id = ?",
          repoPath,
          id
        );
      }),

    notes: withRepo((repoPath) => readNotes(repoPath)),

    note: (id) => withRepo((repoPath) => requireNote(repoPath, id)),

    createNote: (input: CreateNoteInput) =>
      withRepo((repoPath) => {
        const stamp = now();
        const note: CollabNote = {
          id: mint("note"),
          projectId: input.projectId,
          title: named(input.title, "Untitled note"),
          content: input.content,
          createdAt: stamp,
          updatedAt: stamp,
        };
        writeNote(repoPath, note);
        return note;
      }),

    updateNote: (id, input: UpdateNoteInput) =>
      withRepo((repoPath) => {
        const existing = requireNote(repoPath, id);
        const next: CollabNote = {
          ...existing,
          title:
            input.title === undefined
              ? existing.title
              : named(input.title, existing.title),
          content: input.content ?? existing.content,
          updatedAt: now(),
        };
        writeNote(repoPath, next);
        return next;
      }),

    removeNote: (id) =>
      withRepo((repoPath) => {
        execute(
          "DELETE FROM collab_note WHERE repo_path = ? AND id = ?",
          repoPath,
          id
        );
      }),

    bookmarks: withRepo((repoPath) => bookmarks.list(repoPath)),

    addBookmark: (kind: CollabTargetKind, targetId, label) =>
      withRepo((repoPath) => {
        const already = bookmarks
          .list(repoPath)
          .find(
            (bookmark) =>
              bookmarkKey(bookmark.kind, bookmark.targetId) ===
              bookmarkKey(kind, targetId)
          );
        // The star is a toggle: pressing it again is the same star.
        if (already !== undefined) return already;
        const bookmark: CollabBookmark = {
          id: mint("bookmark"),
          kind,
          targetId,
          label: named(label, targetId),
          createdAt: now(),
        };
        bookmarks.put(repoPath, bookmark.id, bookmark.createdAt, bookmark);
        return bookmark;
      }),

    removeBookmark: (kind, targetId) =>
      withRepo((repoPath) => {
        for (const bookmark of bookmarks.list(repoPath)) {
          if (
            bookmarkKey(bookmark.kind, bookmark.targetId) ===
            bookmarkKey(kind, targetId)
          ) {
            bookmarks.remove(repoPath, bookmark.id);
          }
        }
      }),
  };

  return repo;
});
