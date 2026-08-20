import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as FileSystem from "effect/FileSystem";
import { ChildProcessSpawner } from "effect/unstable/process";
import { describe, expect } from "vitest";
import { WorkspaceRepository } from "@byconvo/core/workspace";
import { memoryLayer } from "./workspace-context.ts";
import {
  makeGitWorkspaceRepository,
  revealCommand,
} from "./workspace.repository.git.ts";

const REPO_ROOT = "/repo";

interface Writes {
  readonly directories: Array<string>;
  readonly bytes: Array<{ path: string; contents: string }>;
  readonly copies: Array<{ from: string; to: string }>;
  readonly renames: Array<{ from: string; to: string }>;
}

const withStubFs = (
  present: ReadonlyArray<string> = [],
  listings: Record<string, ReadonlyArray<string>> = {}
) => {
  const writes: Writes = {
    directories: [],
    bytes: [],
    copies: [],
    renames: [],
  };
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
          writeFile: (path, data) =>
            Effect.sync(
              () =>
                void writes.bytes.push({
                  path: String(path),
                  contents: new TextDecoder().decode(data),
                })
            ),
          copy: (from, to) =>
            Effect.sync(
              () =>
                void writes.copies.push({ from: String(from), to: String(to) })
            ),
          rename: (from, to) =>
            Effect.sync(
              () =>
                void writes.renames.push({ from: String(from), to: String(to) })
            ),
          readDirectory: (path) =>
            Effect.succeed([
              ...(listings[String(path).slice(REPO_ROOT.length + 1)] ?? []),
            ]),
        }),
        Layer.succeed(ChildProcessSpawner.ChildProcessSpawner)(
          ChildProcessSpawner.make(() =>
            Effect.die("no process is spawned here")
          )
        )
      )
    )
  );
  return { layer, writes };
};

describe("GitWorkspaceRepository.uploadFile", () => {
  it.effect(
    "decodes the dropped bytes under the folders leading to them",
    () => {
      const { layer, writes } = withStubFs();
      return Effect.gen(function* () {
        const repo = yield* WorkspaceRepository;
        yield* repo.uploadFile("assets/logo.txt", "aGVsbG8=");
        expect(writes.bytes).toEqual([
          { path: `${REPO_ROOT}/assets/logo.txt`, contents: "hello" },
        ]);
        expect(writes.directories).toEqual([`${REPO_ROOT}/assets`]);
      }).pipe(Effect.provide(layer));
    }
  );

  it.effect("refuses a path that is taken, rather than clobbering it", () => {
    const { layer, writes } = withStubFs([`${REPO_ROOT}/keep.txt`]);
    return Effect.gen(function* () {
      const repo = yield* WorkspaceRepository;
      const error = yield* Effect.flip(repo.uploadFile("keep.txt", "aGVsbG8="));
      expect(error._tag).toBe("PathExists");
      expect(writes.bytes).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.effect("refuses a path that escapes the repository root", () => {
    const { layer, writes } = withStubFs();
    return Effect.gen(function* () {
      const repo = yield* WorkspaceRepository;
      const error = yield* Effect.flip(
        repo.uploadFile("../escaped.txt", "aGVsbG8=")
      );
      expect(error._tag).toBe("NoRepoSelected");
      expect(writes.bytes).toEqual([]);
    }).pipe(Effect.provide(layer));
  });
});

describe("GitWorkspaceRepository.trashPath", () => {
  it.effect("moves the path into a numbered slot under its own name", () => {
    const { layer, writes } = withStubFs();
    return Effect.gen(function* () {
      const repo = yield* WorkspaceRepository;
      const trashed = yield* repo.trashPath("src/a.ts");
      expect(trashed.path).toBe(".byconvo/trash/1/a.ts");
      expect(writes.renames).toEqual([
        {
          from: `${REPO_ROOT}/src/a.ts`,
          to: `${REPO_ROOT}/.byconvo/trash/1/a.ts`,
        },
      ]);
    }).pipe(Effect.provide(layer));
  });

  it.effect("takes the next slot, so two of a name can both be deleted", () => {
    const { layer } = withStubFs([], { ".byconvo/trash": ["1", "2"] });
    return Effect.gen(function* () {
      const repo = yield* WorkspaceRepository;
      expect((yield* repo.trashPath("src/a.ts")).path).toBe(
        ".byconvo/trash/3/a.ts"
      );
    }).pipe(Effect.provide(layer));
  });
});

describe("GitWorkspaceRepository.copyPath", () => {
  it.effect("copies whole trees, making the destination's parent first", () => {
    const { layer, writes } = withStubFs([`${REPO_ROOT}/src/lib`]);
    return Effect.gen(function* () {
      const repo = yield* WorkspaceRepository;
      yield* repo.copyPath("src/lib", "vendor/lib");
      expect(writes.copies).toEqual([
        { from: `${REPO_ROOT}/src/lib`, to: `${REPO_ROOT}/vendor/lib` },
      ]);
      expect(writes.directories).toEqual([`${REPO_ROOT}/vendor`]);
    }).pipe(Effect.provide(layer));
  });

  it.effect("refuses to clobber the destination", () => {
    const { layer, writes } = withStubFs([`${REPO_ROOT}/vendor/lib`]);
    return Effect.gen(function* () {
      const repo = yield* WorkspaceRepository;
      const error = yield* Effect.flip(repo.copyPath("src/lib", "vendor/lib"));
      expect(error._tag).toBe("PathExists");
      expect(writes.copies).toEqual([]);
    }).pipe(Effect.provide(layer));
  });
});

describe("revealCommand", () => {
  it("selects the file itself on macOS and Windows", () => {
    expect(revealCommand("darwin", "/repo/src/a.ts")).toEqual({
      command: "open",
      args: ["-R", "/repo/src/a.ts"],
    });
    expect(revealCommand("win32", "/repo/src/a.ts")).toEqual({
      command: "explorer",
      args: ["/select,/repo/src/a.ts"],
    });
  });

  it("opens the folder it sits in everywhere else", () => {
    expect(revealCommand("linux", "/repo/src/a.ts")).toEqual({
      command: "xdg-open",
      args: ["/repo/src"],
    });
    expect(revealCommand("linux", "/a.ts").args).toEqual(["/"]);
  });
});
