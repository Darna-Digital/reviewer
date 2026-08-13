import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { afterEach, beforeEach, describe, expect } from "vitest";
import { CommentsRepository } from "@byconvo/core/comments";
import { closeDatabase, openDatabase } from "../db/database.ts";
import { memoryLayer } from "../workspace/workspace-context.ts";
import { makeSqliteCommentsRepository } from "./comments.repository.sqlite.ts";

const API = "/home/dev/api";
const WEB = "/home/dev/web";

// The repository is built per request, exactly as it is in the server, so each
// case also exercises that state survives between them.
const repoFor = (repoPath: string) =>
  Layer.effect(CommentsRepository)(makeSqliteCommentsRepository).pipe(
    Layer.provide(memoryLayer(repoPath))
  );

beforeEach(() => openDatabase(":memory:"));
afterEach(closeDatabase);

const input = {
  filePath: "src/a.ts",
  side: "additions" as const,
  lineNumber: 12,
  body: "looks good",
  author: "alice",
  target: "worktree",
};

describe("SqliteCommentsRepository", () => {
  it.effect("add stamps id + source=local and lists it back", () =>
    Effect.gen(function* () {
      const repo = yield* CommentsRepository;
      const created = yield* repo.add(input);
      expect(created.source).toBe("local");
      expect(created.id).not.toBe("");
      const all = yield* repo.list;
      expect(all.map((c) => c.body)).toContain("looks good");
    }).pipe(Effect.provide(repoFor(API)))
  );

  it.effect("remove deletes by id", () =>
    Effect.gen(function* () {
      const repo = yield* CommentsRepository;
      const created = yield* repo.add({ ...input, body: "to be removed" });
      yield* repo.remove(created.id);
      const remaining = yield* repo.list;
      expect(remaining.map((c) => c.id)).not.toContain(created.id);
    }).pipe(Effect.provide(repoFor(API)))
  );

  it.effect("update rewrites the body", () =>
    Effect.gen(function* () {
      const repo = yield* CommentsRepository;
      const created = yield* repo.add({ ...input, body: "old" });
      const updated = yield* repo.update(created.id, { body: "new" });
      expect(updated.body).toBe("new");
      expect(updated.id).toBe(created.id);
      const all = yield* repo.list;
      expect(all.find((c) => c.id === created.id)?.body).toBe("new");
    }).pipe(Effect.provide(repoFor(API)))
  );

  it.effect(
    "updating a comment that is gone is a 404, not a storage error",
    () =>
      Effect.gen(function* () {
        const repo = yield* CommentsRepository;
        const failure = yield* Effect.flip(
          repo.update("c-nope", { body: "new" })
        );
        expect(failure._tag).toBe("NotFound");
      }).pipe(Effect.provide(repoFor(API)))
  );

  it.effect("persists across repository instances", () =>
    Effect.gen(function* () {
      // Add through one repository instance...
      const created = yield* Effect.gen(function* () {
        const repo = yield* CommentsRepository;
        return yield* repo.add({ ...input, body: "durable" });
      }).pipe(Effect.provide(repoFor(API)));

      // ...and read it back through a freshly-built one (new request).
      const all = yield* Effect.gen(function* () {
        const repo = yield* CommentsRepository;
        return yield* repo.list;
      }).pipe(Effect.provide(repoFor(API)));

      expect(all.map((c) => c.id)).toContain(created.id);
    })
  );

  it.effect("keeps each root of a multi-repo project to its own comments", () =>
    Effect.gen(function* () {
      const inApi = yield* Effect.gen(function* () {
        const repo = yield* CommentsRepository;
        return yield* repo.add({ ...input, body: "api note" });
      }).pipe(Effect.provide(repoFor(API)));

      yield* Effect.gen(function* () {
        const repo = yield* CommentsRepository;
        yield* repo.add({ ...input, body: "web note" });
      }).pipe(Effect.provide(repoFor(WEB)));

      const webComments = yield* Effect.gen(function* () {
        const repo = yield* CommentsRepository;
        return yield* repo.list;
      }).pipe(Effect.provide(repoFor(WEB)));

      expect(webComments.map((c) => c.body)).toEqual(["web note"]);
      expect(webComments.map((c) => c.id)).not.toContain(inApi.id);
    })
  );
});
