import { NodeFileSystem } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { afterAll, describe, expect } from "vitest";
import { DevCommandsRepository } from "@byconvo/core/local-dev";
import { memoryLayer } from "../workspace/workspace-context.ts";
import { makeFileDevCommandsRepository } from "./local-dev.repository.file.ts";

/** A real project folder holding two git roots — what the store is for. */
const project = mkdtempSync(`${tmpdir()}/byconvo-local-dev-`);
const web = `${project}/web`;
const api = `${project}/api`;
for (const root of [web, api]) mkdirSync(`${root}/.git`, { recursive: true });
afterAll(() => rmSync(project, { recursive: true, force: true }));

const FileRepo = Layer.effect(DevCommandsRepository)(
  makeFileDevCommandsRepository
).pipe(
  Layer.provide(Layer.mergeAll(memoryLayer(project), NodeFileSystem.layer))
);

const storedIn = (root: string): ReadonlyArray<{ id: string }> => {
  try {
    return JSON.parse(
      readFileSync(`${root}/.byconvo/dev-commands.json`, "utf8")
    );
  } catch {
    return [];
  }
};

describe("FileDevCommandsRepository", () => {
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

      yield* repo.remove(front.id);
      yield* repo.remove(back.id);
    }).pipe(Effect.provide(FileRepo))
  );

  it.effect("moving a command rewrites both roots' files", () =>
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
      yield* repo.remove(created.id);
    }).pipe(Effect.provide(FileRepo))
  );

  it.effect("refuses a root the project does not hold", () =>
    Effect.gen(function* () {
      const repo = yield* DevCommandsRepository;
      const failure = yield* Effect.flip(
        repo.create({ name: "web", command: "pnpm dev", repoPath: "/nowhere" })
      );
      expect(failure._tag).toBe("NotFound");
    }).pipe(Effect.provide(FileRepo))
  );
});
