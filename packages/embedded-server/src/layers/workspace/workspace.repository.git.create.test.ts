import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as FileSystem from "effect/FileSystem";
import { ChildProcessSpawner } from "effect/unstable/process";
import { describe, expect } from "vitest";
import { WorkspaceRepository } from "@byconvo/core/workspace";
import { memoryLayer } from "./workspace-context.ts";
import { makeGitWorkspaceRepository } from "./workspace.repository.git.ts";

const REPO_ROOT = "/repo";

interface Writes {
  readonly directories: Array<string>;
  readonly files: Array<{ path: string; contents: string }>;
}

/**
 * The repository under a stub filesystem: `present` are the paths that already
 * exist, and every write is recorded rather than performed.
 */
const withStubFs = (present: ReadonlyArray<string> = []) => {
  const writes: Writes = { directories: [], files: [] };
  const layer = Layer.effect(WorkspaceRepository)(
    makeGitWorkspaceRepository
  ).pipe(
    Layer.provide(
      Layer.mergeAll(
        memoryLayer(REPO_ROOT),
        FileSystem.layerNoop({
          exists: (path) => Effect.succeed(present.includes(String(path))),
          makeDirectory: (path) =>
            Effect.sync(() => void writes.directories.push(String(path))),
          writeFileString: (path, contents) =>
            Effect.sync(
              () => void writes.files.push({ path: String(path), contents })
            ),
        }),
        Layer.succeed(ChildProcessSpawner.ChildProcessSpawner)(
          ChildProcessSpawner.make(() => Effect.die("git is not used here"))
        )
      )
    )
  );
  return { layer, writes };
};

describe("GitWorkspaceRepository.createPath", () => {
  it.effect("writes an empty file under the directories leading to it", () => {
    const { layer, writes } = withStubFs();
    return Effect.gen(function* () {
      const repo = yield* WorkspaceRepository;
      yield* repo.createPath("src/nested/new.ts", "file");
      expect(writes.files).toEqual([
        { path: `${REPO_ROOT}/src/nested/new.ts`, contents: "" },
      ]);
      expect(writes.directories).toEqual([`${REPO_ROOT}/src/nested`]);
    }).pipe(Effect.provide(layer));
  });

  it.effect("makes a directory without writing a file into it", () => {
    const { layer, writes } = withStubFs();
    return Effect.gen(function* () {
      const repo = yield* WorkspaceRepository;
      yield* repo.createPath("docs/guides", "directory");
      expect(writes.directories).toEqual([`${REPO_ROOT}/docs/guides`]);
      expect(writes.files).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.effect("refuses to clobber a path that is already there", () => {
    const { layer, writes } = withStubFs([`${REPO_ROOT}/keep.ts`]);
    return Effect.gen(function* () {
      const repo = yield* WorkspaceRepository;
      const error = yield* Effect.flip(repo.createPath("keep.ts", "file"));
      expect(error._tag).toBe("PathExists");
      expect(writes.files).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.effect("refuses a path that escapes the repository root", () => {
    const { layer, writes } = withStubFs();
    return Effect.gen(function* () {
      const repo = yield* WorkspaceRepository;
      const error = yield* Effect.flip(
        repo.createPath("../escaped.ts", "file")
      );
      expect(error._tag).toBe("NoRepoSelected");
      expect(writes).toEqual({ directories: [], files: [] });
    }).pipe(Effect.provide(layer));
  });
});
