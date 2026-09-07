import { NodeFileSystem } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { afterAll, afterEach, beforeEach, describe, expect } from "vitest";
import { DevCommandsRepository } from "@reviewer/core/local-dev";
import { closeDatabase, openDatabase } from "../db/database.ts";
import { memoryLayer } from "../workspace/workspace-context.ts";
import {
  devCommands,
  makeSqliteDevCommandsRepository,
} from "./local-dev.repository.sqlite.ts";

/** A real project folder holding two git roots — what the store is for. */
const project = mkdtempSync(`${tmpdir()}/reviewer-local-dev-`);
const web = `${project}/web`;
const api = `${project}/api`;
for (const root of [web, api]) mkdirSync(`${root}/.git`, { recursive: true });
afterAll(() => rmSync(project, { recursive: true, force: true }));

const Repo = Layer.effect(DevCommandsRepository)(
  makeSqliteDevCommandsRepository
).pipe(
  Layer.provide(Layer.mergeAll(memoryLayer(project), NodeFileSystem.layer))
);

beforeEach(() => openDatabase(":memory:"));
afterEach(closeDatabase);

const storedIn = (root: string): ReadonlyArray<{ id: string }> =>
  devCommands.list(root);

describe("SqliteDevCommandsRepository", () => {
  it.effect("keeps each root's commands with the root that runs them", () =>
    Effect.gen(function* () {
      const repo = yield* DevCommandsRepository;
      const front = yield* repo.create({
        name: "web",
        command: "pnpm dev",
        repoPath: web,
      });
      const back = yield* repo.create({
        name: "api",
        command: "pnpm serve",
        repoPath: api,
      });
      expect(front.repo).toBe("web");
      expect(back.repo).toBe("api");
      expect(storedIn(web).map((c) => c.id)).toEqual([front.id]);
      expect(storedIn(api).map((c) => c.id)).toEqual([back.id]);

      const all = yield* repo.list;
      expect(all.map((c) => c.repo)).toEqual(["api", "web"]);
    }).pipe(Effect.provide(Repo))
  );

  it.effect("moving a command re-scopes it rather than duplicating it", () =>
    Effect.gen(function* () {
      const repo = yield* DevCommandsRepository;
      const created = yield* repo.create({
        name: "web",
        command: "pnpm dev",
        repoPath: web,
      });
      const moved = yield* repo.update(created.id, { repoPath: api });
      expect(moved.repoPath).toBe(api);
      expect(storedIn(web)).toHaveLength(0);
      expect(storedIn(api).map((c) => c.id)).toEqual([created.id]);
    }).pipe(Effect.provide(Repo))
  );

  it.effect("refuses a root the project does not hold", () =>
    Effect.gen(function* () {
      const repo = yield* DevCommandsRepository;
      const failure = yield* Effect.flip(
        repo.create({ name: "web", command: "pnpm dev", repoPath: "/nowhere" })
      );
      expect(failure._tag).toBe("NotFound");
    }).pipe(Effect.provide(Repo))
  );
});
