import { it } from "@effect/vitest";
import { Effect, Option } from "effect";
import * as FileSystem from "effect/FileSystem";
import * as PlatformError from "effect/PlatformError";
import { describe, expect } from "vitest";
import { linkedWorktrees, scanWorktrees, worktreesOf } from "./repo-scan.ts";

const info = (type: "Directory" | "File"): FileSystem.File.Info => ({
  type,
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
});

const missing = (path: string) =>
  Effect.fail(
    PlatformError.systemError({
      _tag: "NotFound",
      module: "FileSystem",
      method: "stub",
      pathOrDescriptor: path,
    })
  );

/**
 * A repository at `/work/app` on `master` with one linked worktree of
 * `fix/login` beside it — `.git` a directory in the original, a file in the
 * worktree, exactly as git leaves them.
 */
const MAIN = "/work/app";
const LINKED = "/work/.app-worktrees/fix-login";

const directories: ReadonlyArray<string> = [
  "/work",
  MAIN,
  "/work/.app-worktrees",
  LINKED,
  `${MAIN}/.git`,
];

const files: Readonly<Record<string, string>> = {
  [`${MAIN}/.git/HEAD`]: "ref: refs/heads/master\n",
  [`${MAIN}/.git/worktrees/fix-login/gitdir`]: `${LINKED}/.git\n`,
  // Git keeps a linked worktree's HEAD in the original's bookkeeping, not in
  // the worktree — which is why `.git` there is a file pointing back at it.
  [`${MAIN}/.git/worktrees/fix-login/HEAD`]: "ref: refs/heads/fix/login\n",
  [`${LINKED}/.git`]: `gitdir: ${MAIN}/.git/worktrees/fix-login\n`,
};

const listings: Readonly<Record<string, ReadonlyArray<string>>> = {
  "/work": ["app"],
  [`${MAIN}/.git/worktrees`]: ["fix-login"],
};

const stubFs = FileSystem.layerNoop({
  readDirectory: (path) => {
    const names = listings[String(path)];
    return names === undefined
      ? missing(String(path))
      : Effect.succeed([...names]);
  },
  stat: (path) => {
    const at = String(path);
    if (directories.includes(at)) return Effect.succeed(info("Directory"));
    if (files[at] !== undefined) return Effect.succeed(info("File"));
    return missing(at);
  },
  exists: (path) => {
    const at = String(path);
    return Effect.succeed(directories.includes(at) || files[at] !== undefined);
  },
  readFileString: (path) => {
    const contents = files[String(path)];
    return contents === undefined
      ? missing(String(path))
      : Effect.succeed(contents);
  },
});

const withFs = <A>(use: (fs: FileSystem.FileSystem) => Effect.Effect<A>) =>
  Effect.flatMap(FileSystem.FileSystem, use).pipe(Effect.provide(stubFs));

describe("linkedWorktrees", () => {
  it.effect("reads a repository's worktrees out of its own bookkeeping", () =>
    withFs((fs) =>
      Effect.map(linkedWorktrees(fs, MAIN), (paths) => {
        expect(paths).toEqual([LINKED]);
      })
    )
  );

  it.effect("answers with none for a repository that has no worktrees", () =>
    withFs((fs) =>
      Effect.map(linkedWorktrees(fs, "/work/other"), (paths) => {
        expect(paths).toEqual([]);
      })
    )
  );
});

describe("scanWorktrees", () => {
  it.effect("lists a root's worktrees after it, each on its own branch", () =>
    withFs((fs) =>
      Effect.map(scanWorktrees(fs, MAIN), (worktrees) => {
        expect(worktrees).toEqual([
          { name: "app", path: MAIN, branch: "master" },
          { name: "fix-login", path: LINKED, branch: "fix/login" },
        ]);
      })
    )
  );
});

describe("worktreesOf", () => {
  it.effect("answers with the linked worktrees alone, not the roots", () =>
    withFs((fs) =>
      Effect.map(
        worktreesOf(fs, [{ name: "app", path: MAIN, branch: "master" }]),
        (worktrees) => {
          expect(worktrees).toEqual([
            { name: "fix-login", path: LINKED, branch: "fix/login" },
          ]);
        }
      )
    )
  );

  it.effect("answers with none for a root that has no worktrees", () =>
    withFs((fs) =>
      Effect.map(
        worktreesOf(fs, [
          { name: "other", path: "/work/other", branch: "master" },
        ]),
        (worktrees) => {
          expect(worktrees).toEqual([]);
        }
      )
    )
  );
});
