import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { afterEach, beforeEach, describe, expect } from "vitest";
import {
  CollabRepository,
  CollabService,
  makeCollabService,
} from "@byconvo/core/collab";
import { closeDatabase, openDatabase } from "../db/database.ts";
import { memoryLayer } from "../workspace/workspace-context.ts";
import { makeSqliteCollabRepository } from "./collab.repository.sqlite.ts";

const API = "/home/dev/api";
const WEB = "/home/dev/web";

/**
 * Built per request, exactly as the server builds it — so every case also
 * checks that what one request wrote the next one can read.
 */
const collabFor = (repoPath: string) =>
  Layer.effect(CollabService)(makeCollabService).pipe(
    Layer.provide(
      Layer.effect(CollabRepository)(makeSqliteCollabRepository).pipe(
        Layer.provide(memoryLayer(repoPath))
      )
    )
  );

beforeEach(() => openDatabase(":memory:"));
afterEach(closeDatabase);

describe("SqliteCollabRepository", () => {
  it.effect(
    "a project round-trips with its lists and shows on the home page",
    () =>
      Effect.gen(function* () {
        const service = yield* CollabService;
        const created = yield* service.createProject({
          name: "Redesign",
          purpose: "Make it read like Basecamp",
        });

        const home = yield* service.home;
        expect(home.map((entry) => entry.project.id)).toEqual([created.id]);
        expect(home[0]?.project.lists.map((list) => list.id)).toEqual([
          "todo",
          "doing",
          "done",
        ]);
        expect(home[0]?.progress).toEqual({ done: 0, total: 0 });
      }).pipe(Effect.provide(collabFor(API)))
  );

  it.effect("work is scoped to the repository it was written in", () =>
    Effect.gen(function* () {
      const service = yield* CollabService;
      yield* service.createProject({ name: "API project", purpose: "" });
    }).pipe(
      Effect.provide(collabFor(API)),
      Effect.andThen(
        Effect.gen(function* () {
          const service = yield* CollabService;
          expect(yield* service.home).toEqual([]);
          yield* service.createProject({ name: "Web project", purpose: "" });
          const home = yield* service.home;
          expect(home.map((entry) => entry.project.name)).toEqual([
            "Web project",
          ]);
        }).pipe(Effect.provide(collabFor(WEB)))
      )
    )
  );

  it.effect("moving a card writes one row and the board reads it back", () =>
    Effect.gen(function* () {
      const service = yield* CollabService;
      const project = yield* service.createProject({
        name: "Redesign",
        purpose: "",
      });
      const todo = yield* service.createTodo(project.id, { title: "Sketch" });
      yield* service.createTodo(project.id, { title: "Build" });

      yield* service.updateTodo(todo.id, { listId: "doing" });

      const columns = yield* service.board(project.id);
      expect(columns.map((column) => column.todos.length)).toEqual([1, 1, 0]);
      expect(columns[1]?.todos[0]?.id).toBe(todo.id);
    }).pipe(Effect.provide(collabFor(API)))
  );

  it.effect(
    "removing a list hands its cards to the first column, in one go",
    () =>
      Effect.gen(function* () {
        const service = yield* CollabService;
        const project = yield* service.createProject({
          name: "Redesign",
          purpose: "",
        });
        const todo = yield* service.createTodo(project.id, {
          title: "Sketch",
          listId: "doing",
        });

        const after = yield* service.removeList(project.id, "doing");
        expect(after.lists.map((list) => list.id)).toEqual(["todo", "done"]);
        expect((yield* service.todos).map((t) => t.listId)).toEqual(["todo"]);
        expect(todo.listId).toBe("doing");
      }).pipe(Effect.provide(collabFor(API)))
  );

  it.effect("deleting a project sweeps its todos and notes with it", () =>
    Effect.gen(function* () {
      const service = yield* CollabService;
      const project = yield* service.createProject({
        name: "Redesign",
        purpose: "",
      });
      const other = yield* service.createProject({ name: "Keep", purpose: "" });
      yield* service.createTodo(project.id, { title: "Goes" });
      yield* service.createTodo(other.id, { title: "Stays" });
      yield* service.createNote({
        title: "Goes too",
        projectId: project.id,
        content: "",
      });
      yield* service.createNote({
        title: "Personal",
        projectId: "",
        content: "",
      });

      yield* service.removeProject(project.id);

      expect((yield* service.todos).map((t) => t.title)).toEqual(["Stays"]);
      expect((yield* service.notes).map((n) => n.title)).toEqual(["Personal"]);
    }).pipe(Effect.provide(collabFor(API)))
  );

  it.effect("a note is written and read back as a doc", () =>
    Effect.gen(function* () {
      const service = yield* CollabService;
      const note = yield* service.createNote({
        title: "Kickoff",
        projectId: "",
        content: "",
      });
      yield* service.updateNote(note.id, { content: "# Kickoff\n\nHello." });

      const read = yield* service.note(note.id);
      expect(read.content).toBe("# Kickoff\n\nHello.");
      expect(read.updatedAt >= note.updatedAt).toBe(true);
    }).pipe(Effect.provide(collabFor(API)))
  );

  it.effect("starring is a toggle, however many times it is pressed", () =>
    Effect.gen(function* () {
      const service = yield* CollabService;
      const project = yield* service.createProject({
        name: "Redesign",
        purpose: "",
      });
      yield* service.addBookmark("project", project.id, project.name);
      yield* service.addBookmark("project", project.id, project.name);

      const mine = yield* service.mine("");
      expect(mine.bookmarks).toHaveLength(1);

      yield* service.removeBookmark("project", project.id);
      expect((yield* service.mine("")).bookmarks).toEqual([]);
    }).pipe(Effect.provide(collabFor(API)))
  );

  it.effect("asking for a project that is not there is a NotFound", () =>
    Effect.gen(function* () {
      const service = yield* CollabService;
      const failure = yield* Effect.flip(service.detail("nope"));
      expect(failure._tag).toBe("NotFound");
    }).pipe(Effect.provide(collabFor(API)))
  );
});
