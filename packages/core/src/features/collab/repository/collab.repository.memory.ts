/**
 * The collaboration store, in memory.
 *
 * It exists for two callers: the service's own tests, and anything that wants
 * to drive the feature without a database behind it. Both want the same thing
 * from it — that it behave *exactly* as the sqlite store does — so the rules it
 * enforces (where a card lands, what happens to cards in a deleted list, that a
 * star is unique) are the shared functions rather than a second reading of
 * them.
 *
 * Ids and timestamps are the two things a store cannot avoid inventing, and the
 * two things a test cannot predict. They come from injected counters here, so
 * an assertion can name `project-1` and mean it.
 */
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import { NotFound, StorageError } from "../../../shared.ts";
import {
  DEFAULT_LISTS,
  type CollabBookmark,
  type CollabList,
  type CollabNote,
  type CollabProject,
  type CollabTargetKind,
  type CollabTodo,
} from "../schema/collab.schema.ts";
import {
  bookmarkKey,
  named,
  nextListColor,
  nextOrder,
  nextProjectColor,
  projectLists,
  resolveListId,
  sortedLists,
} from "../functions/collab.functions.ts";
import type {
  CollabRepo,
  CreateNoteInput,
  CreateProjectInput,
  CreateTodoInput,
  UpdateListInput,
  UpdateNoteInput,
  UpdateProjectInput,
  UpdateTodoInput,
} from "./collab.repository.ts";

const NOW = "2026-01-01T00:00:00.000Z";

export interface MemoryCollabSeed {
  readonly projects?: ReadonlyArray<CollabProject>;
  readonly todos?: ReadonlyArray<CollabTodo>;
  readonly notes?: ReadonlyArray<CollabNote>;
  readonly bookmarks?: ReadonlyArray<CollabBookmark>;
}

export const makeMemoryCollabRepository = (seed: MemoryCollabSeed = {}) =>
  Effect.gen(function* () {
    const projectsRef = yield* Ref.make<ReadonlyArray<CollabProject>>([
      ...(seed.projects ?? []),
    ]);
    const todosRef = yield* Ref.make<ReadonlyArray<CollabTodo>>([
      ...(seed.todos ?? []),
    ]);
    const notesRef = yield* Ref.make<ReadonlyArray<CollabNote>>([
      ...(seed.notes ?? []),
    ]);
    const bookmarksRef = yield* Ref.make<ReadonlyArray<CollabBookmark>>([
      ...(seed.bookmarks ?? []),
    ]);

    let counter = 0;
    const mint = (prefix: string) => {
      counter += 1;
      return `${prefix}-${counter}`;
    };

    const requireProject = (id: string) =>
      Effect.flatMap(Ref.get(projectsRef), (projects) => {
        const found = projects.find((project) => project.id === id);
        return found === undefined
          ? Effect.fail(new NotFound({ reason: `project ${id} not found` }))
          : Effect.succeed(found);
      });

    const putProject = (next: CollabProject) =>
      Effect.as(
        Ref.update(projectsRef, (all) =>
          all.map((project) => (project.id === next.id ? next : project))
        ),
        next
      );

    const requireTodo = (id: string) =>
      Effect.flatMap(Ref.get(todosRef), (todos) => {
        const found = todos.find((todo) => todo.id === id);
        return found === undefined
          ? Effect.fail(new NotFound({ reason: `todo ${id} not found` }))
          : Effect.succeed(found);
      });

    const requireNote = (id: string) =>
      Effect.flatMap(Ref.get(notesRef), (notes) => {
        const found = notes.find((note) => note.id === id);
        return found === undefined
          ? Effect.fail(new NotFound({ reason: `note ${id} not found` }))
          : Effect.succeed(found);
      });

    const repo: CollabRepo = {
      projects: Ref.get(projectsRef),

      project: requireProject,

      createProject: (input: CreateProjectInput) =>
        Effect.gen(function* () {
          const existing = yield* Ref.get(projectsRef);
          const project: CollabProject = {
            id: mint("project"),
            name: named(input.name, "Untitled project"),
            purpose: input.purpose.trim(),
            color: input.color ?? nextProjectColor(existing),
            lists: DEFAULT_LISTS,
            archived: false,
            createdAt: NOW,
            updatedAt: NOW,
          };
          yield* Ref.update(projectsRef, (all) => [...all, project]);
          return project;
        }),

      updateProject: (id, input: UpdateProjectInput) =>
        Effect.flatMap(requireProject(id), (project) =>
          putProject({
            ...project,
            name:
              input.name === undefined
                ? project.name
                : named(input.name, project.name),
            purpose: input.purpose?.trim() ?? project.purpose,
            color: input.color ?? project.color,
            archived: input.archived ?? project.archived,
            updatedAt: NOW,
          })
        ),

      removeProject: (id) =>
        Effect.gen(function* () {
          yield* Ref.update(projectsRef, (all) =>
            all.filter((project) => project.id !== id)
          );
          // The work goes with the place it was done — a todo whose project is
          // gone can be reached from nowhere, so leaving it is only a leak.
          yield* Ref.update(todosRef, (all) =>
            all.filter((todo) => todo.projectId !== id)
          );
          yield* Ref.update(notesRef, (all) =>
            all.filter((note) => note.projectId !== id)
          );
        }),

      addList: (projectId, name) =>
        Effect.flatMap(requireProject(projectId), (project) => {
          const lists = projectLists(project);
          const list: CollabList = {
            id: mint("list"),
            name: named(name, "New list"),
            order: lists.reduce((max, l) => Math.max(max, l.order), -1) + 1,
            color: nextListColor(lists),
          };
          return putProject({
            ...project,
            lists: [...lists, list],
            updatedAt: NOW,
          });
        }),

      updateList: (projectId, listId, input: UpdateListInput) =>
        Effect.flatMap(requireProject(projectId), (project) => {
          const lists = projectLists(project);
          if (!lists.some((list) => list.id === listId)) {
            return Effect.fail(
              new NotFound({ reason: `list ${listId} not found` })
            );
          }
          return putProject({
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
            updatedAt: NOW,
          });
        }),

      removeList: (projectId, listId) =>
        Effect.gen(function* () {
          const project = yield* requireProject(projectId);
          const lists = projectLists(project);
          if (lists.length <= 1) {
            return yield* Effect.fail(
              new StorageError({ reason: "a project needs at least one list" })
            );
          }
          const remaining = sortedLists(
            lists.filter((list) => list.id !== listId)
          );
          const next = { ...project, lists: remaining, updatedAt: NOW };
          const fallback = remaining[0].id;
          yield* Ref.update(todosRef, (all) =>
            all.map((todo) =>
              todo.projectId === projectId && todo.listId === listId
                ? { ...todo, listId: fallback, updatedAt: NOW }
                : todo
            )
          );
          return yield* putProject(next);
        }),

      todos: Ref.get(todosRef),

      createTodo: (projectId, input: CreateTodoInput) =>
        Effect.gen(function* () {
          const project = yield* requireProject(projectId);
          const todos = yield* Ref.get(todosRef);
          const listId = resolveListId(
            project,
            input.listId ?? projectLists(project)[0].id
          );
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
              todos.filter((t) => t.projectId === projectId),
              listId
            ),
            createdAt: NOW,
            updatedAt: NOW,
          };
          yield* Ref.update(todosRef, (all) => [...all, todo]);
          return todo;
        }),

      updateTodo: (id, input: UpdateTodoInput) =>
        Effect.gen(function* () {
          const existing = yield* requireTodo(id);
          const project = yield* requireProject(existing.projectId);
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
            updatedAt: NOW,
          };
          yield* Ref.update(todosRef, (all) =>
            all.map((todo) => (todo.id === id ? next : todo))
          );
          return next;
        }),

      removeTodo: (id) =>
        Ref.update(todosRef, (all) => all.filter((todo) => todo.id !== id)),

      notes: Ref.get(notesRef),

      note: requireNote,

      createNote: (input: CreateNoteInput) =>
        Effect.gen(function* () {
          const note: CollabNote = {
            id: mint("note"),
            projectId: input.projectId,
            title: named(input.title, "Untitled note"),
            content: input.content,
            createdAt: NOW,
            updatedAt: NOW,
          };
          yield* Ref.update(notesRef, (all) => [...all, note]);
          return note;
        }),

      updateNote: (id, input: UpdateNoteInput) =>
        Effect.flatMap(requireNote(id), (existing) => {
          const next: CollabNote = {
            ...existing,
            title:
              input.title === undefined
                ? existing.title
                : named(input.title, existing.title),
            content: input.content ?? existing.content,
            updatedAt: NOW,
          };
          return Effect.as(
            Ref.update(notesRef, (all) =>
              all.map((note) => (note.id === id ? next : note))
            ),
            next
          );
        }),

      removeNote: (id) =>
        Ref.update(notesRef, (all) => all.filter((note) => note.id !== id)),

      bookmarks: Ref.get(bookmarksRef),

      addBookmark: (kind: CollabTargetKind, targetId, label) =>
        Effect.gen(function* () {
          const existing = yield* Ref.get(bookmarksRef);
          const already = existing.find(
            (bookmark) =>
              bookmarkKey(bookmark.kind, bookmark.targetId) ===
              bookmarkKey(kind, targetId)
          );
          // Starring what is already starred is the same star, not a second
          // one: the button is a toggle and a repeat is a double-click.
          if (already !== undefined) return already;
          const bookmark: CollabBookmark = {
            id: mint("bookmark"),
            kind,
            targetId,
            label: named(label, targetId),
            createdAt: NOW,
          };
          yield* Ref.update(bookmarksRef, (all) => [...all, bookmark]);
          return bookmark;
        }),

      removeBookmark: (kind, targetId) =>
        Ref.update(bookmarksRef, (all) =>
          all.filter(
            (bookmark) =>
              bookmarkKey(bookmark.kind, bookmark.targetId) !==
              bookmarkKey(kind, targetId)
          )
        ),
    };

    return repo;
  });
