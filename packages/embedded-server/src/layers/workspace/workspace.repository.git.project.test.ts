import { it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import * as FileSystem from "effect/FileSystem";
import * as PlatformError from "effect/PlatformError";
import { ChildProcessSpawner } from "effect/unstable/process";
import { describe, expect } from "vitest";
import { WorkspaceRepository } from "@reviewer/core/workspace";
import { memoryLayer } from "./workspace-context.ts";
import { makeGitWorkspaceRepository } from "./workspace.repository.git.ts";

const PROJECT = "/work";

const directory: FileSystem.File.Info = {
  type: "Directory",
  mtime: Option.none(),
  atime: Option.none(),
  birthtime: Option.none(),
  dev: 0,
  ino: Option.none(),
  mode: 0,
  nlink: Option.none(),
  uid: Option.none(),
  gid: Option.none(),
  rdev: Option.none(),
  size: FileSystem.Size(0),
  blksize: Option.none(),
  blocks: Option.none(),
};

/**
 * A project folder holding `backend` and `frontend` side by side, plus a plain
 * `notes` directory — the arrangement this feature exists for.
 */
const TREE: Readonly<Record<string, ReadonlyArray<string>>> = {
  "/work": ["backend", "frontend", "notes"],
  "/work/backend": [],
  "/work/frontend": [],
  "/work/notes": [],
};
const ROOTS = ["/work/backend", "/work/frontend"];

const layer = Layer.effect(WorkspaceRepository)(
  makeGitWorkspaceRepository
).pipe(
  Layer.provide(
    Layer.mergeAll(
      memoryLayer(PROJECT),
      FileSystem.layerNoop({
        readDirectory: (path) => {
          const names = TREE[String(path)];
          return names === undefined
            ? Effect.fail(
                PlatformError.systemError({
                  _tag: "NotFound",
                  module: "FileSystem",
                  method: "readDirectory",
                  pathOrDescriptor: String(path),
                })
              )
            : Effect.succeed([...names]);
        },
        stat: (path) =>
          TREE[String(path)] !== undefined ||
          ROOTS.some((root) => `${root}/.git` === String(path))
            ? Effect.succeed(directory)
            : Effect.fail(
                PlatformError.systemError({
                  _tag: "NotFound",
                  module: "FileSystem",
                  method: "stat",
                  pathOrDescriptor: String(path),
                })
              ),
        exists: (path) =>
          Effect.succeed(ROOTS.some((root) => `${root}/.git` === String(path))),
        readFileString: () => Effect.succeed("ref: refs/heads/main\n"),
      }),
      Layer.succeed(ChildProcessSpawner.ChildProcessSpawner)(
        ChildProcessSpawner.make(() => Effect.die("git is not used here"))
      )
    )
  )
);

describe("GitWorkspaceRepository, multi-repo project", () => {
  it.effect("info lists every root the project holds", () =>
    Effect.gen(function* () {
      const repo = yield* WorkspaceRepository;
      const info = yield* repo.info;
      expect(info.project).toBe(PROJECT);
      expect(info.repos.map((entry) => entry.name)).toEqual([
        "backend",
        "frontend",
      ]);
      expect(info.repos.map((entry) => entry.branch)).toEqual(["main", "main"]);
    }).pipe(Effect.provide(layer))
  );

  it.effect("selectRepo moves the git views without closing the project", () =>
    Effect.gen(function* () {
      const repo = yield* WorkspaceRepository;
      const info = yield* repo.selectRepo("/work/frontend");
      expect(info.current).toBe("/work/frontend");
      expect(info.project).toBe(PROJECT);
    }).pipe(Effect.provide(layer))
  );

  it.effect("selectRepo refuses a folder that is not one of the roots", () =>
    Effect.gen(function* () {
      const repo = yield* WorkspaceRepository;
      const error = yield* Effect.flip(repo.selectRepo("/work/notes"));
      expect(error._tag).toBe("InvalidRepo");
    }).pipe(Effect.provide(layer))
  );

  it.effect("browse marks a folder of repositories as openable", () =>
    Effect.gen(function* () {
      const repo = yield* WorkspaceRepository;
      const payload = yield* repo.browse(PROJECT);
      expect(payload.repoCount).toBe(2);
      const notes = payload.entries.find((entry) => entry.name === "notes");
      expect(notes).toEqual({
        name: "notes",
        path: "/work/notes",
        isGitRepo: false,
        repoCount: 0,
      });
      const backend = payload.entries.find((entry) => entry.name === "backend");
      expect(backend?.isGitRepo).toBe(true);
    }).pipe(Effect.provide(layer))
  );
});
