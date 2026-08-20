import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { CollabMemory } from "../layer/collab.layer.memory.ts";
import { CollabService } from "./collab.service.ts";

/** A project with one to-do on it, which is what most of these start from. */
const seeded = Effect.gen(function* () {
  const service = yield* CollabService;
  const project = yield* service.createProject({
    name: "  Redesign the collaboration mode  ",
    purpose: "Make it read like Basecamp",
  });
  return { service, project };
});

describe("CollabService", () => {
  it.effect("mints a project with the default lists and a trimmed name", () =>
    Effect.gen(function* () {
      const { project } = yield* seeded;
      expect(project.name).toBe("Redesign the collaboration mode");
      expect(project.lists.map((list) => list.id)).toEqual([
        "todo",
        "doing",
        "done",
      ]);
      expect(project.archived).toBe(false);
    }).pipe(Effect.provide(CollabMemory()))
  );

  it.effect("lands a new to-do at the end of the list it was given", () =>
    Effect.gen(function* () {
      const { service, project } = yield* seeded;
      const first = yield* service.createTodo(project.id, { title: "Sketch" });
      const second = yield* service.createTodo(project.id, {
        title: "Build",
        listId: "todo",
      });
      expect(first.listId).toBe("todo");
      expect(second.order).toBeGreaterThan(first.order);
    }).pipe(Effect.provide(CollabMemory()))
  );

  it.effect("puts a to-do aimed at an unknown list in the first one", () =>
    Effect.gen(function* () {
      const { service, project } = yield* seeded;
      const todo = yield* service.createTodo(project.id, {
        title: "Stray",
        listId: "no-such-list",
      });
      expect(todo.listId).toBe("todo");
    }).pipe(Effect.provide(CollabMemory()))
  );

  it.effect("moving a card across the board is one write on that card", () =>
    Effect.gen(function* () {
      const { service, project } = yield* seeded;
      const todo = yield* service.createTodo(project.id, { title: "Sketch" });
      const moved = yield* service.updateTodo(todo.id, {
        listId: "doing",
        order: 1,
      });
      expect(moved.listId).toBe("doing");

      const columns = yield* service.board(project.id);
      expect(columns.map((column) => column.list.id)).toEqual([
        "todo",
        "doing",
        "done",
      ]);
      expect(columns[0]?.todos).toEqual([]);
      expect(columns[1]?.todos.map((t) => t.id)).toEqual([todo.id]);
    }).pipe(Effect.provide(CollabMemory()))
  );

  it.effect("a removed list hands its cards back to the first column", () =>
    Effect.gen(function* () {
      const { service, project } = yield* seeded;
      const todo = yield* service.createTodo(project.id, {
        title: "Sketch",
        listId: "doing",
      });
      const after = yield* service.removeList(project.id, "doing");
      expect(after.lists.map((list) => list.id)).toEqual(["todo", "done"]);

      const columns = yield* service.board(project.id);
      expect(columns[0]?.todos.map((t) => t.id)).toEqual([todo.id]);
    }).pipe(Effect.provide(CollabMemory()))
  );

  it.effect("refuses to remove a project's last list", () =>
    Effect.gen(function* () {
      const { service, project } = yield* seeded;
      yield* service.removeList(project.id, "doing");
      yield* service.removeList(project.id, "done");
      const failure = yield* Effect.flip(
        service.removeList(project.id, "todo")
      );
      expect(failure._tag).toBe("StorageError");
    }).pipe(Effect.provide(CollabMemory()))
  );

  it.effect("a new list gets a colour of its own", () =>
    Effect.gen(function* () {
      const { service, project } = yield* seeded;
      const after = yield* service.addList(project.id, "  Shipped  ");
      const added = after.lists.at(-1);
      expect(added?.name).toBe("Shipped");
      expect(added?.color).toMatch(/^#[0-9a-f]{6}$/i);
    }).pipe(Effect.provide(CollabMemory()))
  );

  it.effect("the home page counts each project's work", () =>
    Effect.gen(function* () {
      const { service, project } = yield* seeded;
      const one = yield* service.createTodo(project.id, { title: "Sketch" });
      yield* service.createTodo(project.id, { title: "Build" });
      yield* service.updateTodo(one.id, { done: true });

      const home = yield* service.home;
      expect(home).toHaveLength(1);
      expect(home[0]?.progress).toEqual({ done: 1, total: 2 });
    }).pipe(Effect.provide(CollabMemory()))
  );

  it.effect("detail carries a project's own work and nobody else's", () =>
    Effect.gen(function* () {
      const { service, project } = yield* seeded;
      const other = yield* service.createProject({
        name: "Other",
        purpose: "",
      });
      yield* service.createTodo(project.id, { title: "Mine" });
      yield* service.createTodo(other.id, { title: "Theirs" });
      yield* service.createNote({
        title: "Kickoff",
        projectId: project.id,
        content: "# Kickoff",
      });

      const detail = yield* service.detail(project.id);
      expect(detail.todos.map((todo) => todo.title)).toEqual(["Mine"]);
      expect(detail.notes.map((note) => note.title)).toEqual(["Kickoff"]);
    }).pipe(Effect.provide(CollabMemory()))
  );

  it.effect("deleting a project takes its work and notes with it", () =>
    Effect.gen(function* () {
      const { service, project } = yield* seeded;
      yield* service.createTodo(project.id, { title: "Sketch" });
      yield* service.createNote({
        title: "Kickoff",
        projectId: project.id,
        content: "",
      });
      yield* service.removeProject(project.id);

      expect(yield* service.todos).toEqual([]);
      expect(yield* service.notes).toEqual([]);
      expect(yield* service.home).toEqual([]);
    }).pipe(Effect.provide(CollabMemory()))
  );

  it.effect(
    "`mine` is one viewer's open work, their notes and their stars",
    () =>
      Effect.gen(function* () {
        const { service, project } = yield* seeded;
        const mineSoon = yield* service.createTodo(project.id, {
          title: "Due soon",
          assignee: "Rūtenis",
          dueOn: "2026-02-01",
        });
        yield* service.createTodo(project.id, {
          title: "Theirs",
          assignee: "Someone else",
        });
        const finished = yield* service.createTodo(project.id, {
          title: "Done already",
          assignee: "Rūtenis",
        });
        yield* service.updateTodo(finished.id, { done: true });
        yield* service.createNote({
          title: "Scratch",
          projectId: "",
          content: "",
        });
        yield* service.addBookmark("project", project.id, project.name);

        const mine = yield* service.mine("rūtenis");
        expect(mine.todos.map((todo) => todo.id)).toEqual([mineSoon.id]);
        expect(mine.notes.map((note) => note.title)).toEqual(["Scratch"]);
        expect(mine.bookmarks.map((b) => b.label)).toEqual([
          "Redesign the collaboration mode",
        ]);
      }).pipe(Effect.provide(CollabMemory()))
  );

  it.effect("starring twice leaves one star, and un-starring clears it", () =>
    Effect.gen(function* () {
      const { service, project } = yield* seeded;
      const first = yield* service.addBookmark("project", project.id, "One");
      const again = yield* service.addBookmark("project", project.id, "Two");
      expect(again.id).toBe(first.id);
      expect(yield* service.bookmarks).toHaveLength(1);

      yield* service.removeBookmark("project", project.id);
      expect(yield* service.bookmarks).toEqual([]);
    }).pipe(Effect.provide(CollabMemory()))
  );

  it.effect(
    "a note is a doc: title, markdown, and when it was last written",
    () =>
      Effect.gen(function* () {
        const { service } = yield* seeded;
        const note = yield* service.createNote({
          title: "  Scratch  ",
          projectId: "",
          content: "",
        });
        expect(note.title).toBe("Scratch");

        const written = yield* service.updateNote(note.id, {
          content: "# Scratch\n\nSomething worth keeping.",
        });
        expect(written.content).toContain("worth keeping");
        expect((yield* service.note(note.id)).content).toBe(written.content);
      }).pipe(Effect.provide(CollabMemory()))
  );

  it.effect(
    "asking for a project that is not there is a 404, not a crash",
    () =>
      Effect.gen(function* () {
        const service = yield* CollabService;
        const failure = yield* Effect.flip(service.detail("nope"));
        expect(failure._tag).toBe("NotFound");
      }).pipe(Effect.provide(CollabMemory()))
  );
});
