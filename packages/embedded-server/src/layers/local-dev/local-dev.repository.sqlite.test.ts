import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { afterEach, beforeEach, describe, expect } from "vitest";
import { DevCommandsRepository } from "@reviewer/core/local-dev";
import { closeDatabase, openDatabase } from "../db/database.ts";
import { memoryLayer } from "../workspace/workspace-context.ts";
import {
  devCommands,
  makeSqliteDevCommandsRepository,
} from "./local-dev.repository.sqlite.ts";

const REPO = "/work/web";

const Repo = Layer.effect(DevCommandsRepository)(
  makeSqliteDevCommandsRepository
).pipe(Layer.provide(memoryLayer(REPO)));

beforeEach(() => openDatabase(":memory:"));
afterEach(closeDatabase);

describe("SqliteDevCommandsRepository", () => {
  it.effect("keeps commands with the repository that runs them", () =>
    Effect.gen(function* () {
      const repo = yield* DevCommandsRepository;
      const created = yield* repo.create({ name: "web", command: "pnpm dev" });
      expect(devCommands.list(REPO).map((c) => c.id)).toEqual([created.id]);
      const all = yield* repo.list;
      expect(all.map((c) => c.name)).toEqual(["web"]);
    }).pipe(Effect.provide(Repo))
  );

  it.effect("stores the folder a command runs in, normalised", () =>
    Effect.gen(function* () {
      const repo = yield* DevCommandsRepository;
      const created = yield* repo.create({
        name: "web",
        command: "pnpm dev",
        cwd: "./packages/web/",
      });
      expect(created.cwd).toBe("packages/web");
      const moved = yield* repo.update(created.id, { cwd: "" });
      expect(moved.cwd).toBe("");
    }).pipe(Effect.provide(Repo))
  );

  it.effect("reads a command stored before folders as the root's", () =>
    Effect.gen(function* () {
      const repo = yield* DevCommandsRepository;
      const created = yield* repo.create({ name: "web", command: "pnpm dev" });
      const { cwd: _cwd, ...legacy } = created;
      devCommands.put(REPO, created.id, created.createdAt, legacy as never);
      const read = yield* repo.get(created.id);
      expect(read.cwd).toBe("");
    }).pipe(Effect.provide(Repo))
  );

  it.effect("update rewrites in place", () =>
    Effect.gen(function* () {
      const repo = yield* DevCommandsRepository;
      const created = yield* repo.create({ name: "web", command: "pnpm dev" });
      const updated = yield* repo.update(created.id, { command: "pnpm start" });
      expect(updated.command).toBe("pnpm start");
      expect(devCommands.list(REPO)).toHaveLength(1);
    }).pipe(Effect.provide(Repo))
  );

  it.effect("remove forgets the command", () =>
    Effect.gen(function* () {
      const repo = yield* DevCommandsRepository;
      const created = yield* repo.create({ name: "web", command: "pnpm dev" });
      yield* repo.remove(created.id);
      expect(yield* repo.list).toEqual([]);
      const error = yield* Effect.flip(repo.get(created.id));
      expect(error._tag).toBe("NotFound");
    }).pipe(Effect.provide(Repo))
  );

  it.effect("fails with NoRepoSelected when nothing is open", () =>
    Effect.gen(function* () {
      const repo = yield* DevCommandsRepository;
      const error = yield* Effect.flip(repo.list);
      expect(error._tag).toBe("NoRepoSelected");
    }).pipe(
      Effect.provide(
        Layer.effect(DevCommandsRepository)(
          makeSqliteDevCommandsRepository
        ).pipe(Layer.provide(memoryLayer(null)))
      )
    )
  );
});
