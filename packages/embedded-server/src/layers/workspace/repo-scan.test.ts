import { it } from "@effect/vitest";
import { Effect, Option } from "effect";
import * as ByteSize from "effect/ByteSize";
import * as FileSystem from "effect/FileSystem";
import * as PlatformError from "effect/PlatformError";
import { describe, expect } from "vitest";
import { countRepos, readBranch, scanRepos } from "./repo-scan.ts";

/** A folder tree: each key is a directory, each value the names it holds. */
type Tree = Readonly<Record<string, ReadonlyArray<string>>>;
/** Git roots in the tree, mapped to the branch each has checked out. */
type Roots = Readonly<Record<string, string | null>>;

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
  size: ByteSize.bytes(0),
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
 * A stub filesystem over `tree`: every git root gets a `.git` directory whose
 * HEAD names its branch (or a raw sha when the root is detached).
 */
const stubFs = (tree: Tree, roots: Roots = {}) => {
  const dotGitOf = (path: string): string | null => {
    const match = Object.keys(roots).find((root) => `${root}/.git` === path);
    return match ?? null;
  };
  const headOf = (path: string): string | null => {
    const match = Object.keys(roots).find(
      (root) => `${root}/.git/HEAD` === path
    );
    return match ?? null;
  };
  return FileSystem.layerNoop({
    readDirectory: (path) => {
      const names = tree[String(path)];
      return names === undefined
        ? missing(String(path))
        : Effect.succeed([...names]);
    },
    stat: (path) => {
      const at = String(path);
      if (tree[at] !== undefined) return Effect.succeed(info("Directory"));
      if (dotGitOf(at) !== null) return Effect.succeed(info("Directory"));
      return missing(at);
    },
    exists: (path) => {
      const at = String(path);
      return Effect.succeed(tree[at] !== undefined || dotGitOf(at) !== null);
    },
    readFileString: (path) => {
      const root = headOf(String(path));
      if (root === null) return missing(String(path));
      const branch = roots[root];
      return Effect.succeed(
        branch === null || branch === undefined
          ? "a9c8fb5c0f2b7d1e\n"
          : `ref: refs/heads/${branch}\n`
      );
    },
  });
};

const withFs = <A>(
  tree: Tree,
  roots: Roots,
  use: (fs: FileSystem.FileSystem) => Effect.Effect<A>
) =>
  Effect.flatMap(FileSystem.FileSystem, use).pipe(
    Effect.provide(stubFs(tree, roots))
  );

describe("scanRepos", () => {
  it.effect("finds the repositories a parent folder holds", () =>
    withFs(
      {
        "/work": ["backend", "frontend", "notes"],
        "/work/backend": ["src"],
        "/work/frontend": ["src"],
        "/work/notes": [],
      },
      { "/work/backend": "main", "/work/frontend": "main" },
      (fs) =>
        Effect.map(scanRepos(fs, "/work"), (repos) => {
          expect(repos.map((repo) => repo.name)).toEqual([
            "backend",
            "frontend",
          ]);
          expect(repos.map((repo) => repo.path)).toEqual([
            "/work/backend",
            "/work/frontend",
          ]);
        })
    )
  );

  it.effect("reads the branch each repository is on", () =>
    withFs(
      {
        "/work": ["backend", "frontend"],
        "/work/backend": [],
        "/work/frontend": [],
      },
      { "/work/backend": "main", "/work/frontend": "feat/checkout" },
      (fs) =>
        Effect.map(scanRepos(fs, "/work"), (repos) => {
          expect(repos.map((repo) => repo.branch)).toEqual([
            "main",
            "feat/checkout",
          ]);
        })
    )
  );

  it.effect("reports a detached head as no branch", () =>
    withFs(
      { "/work": ["backend"], "/work/backend": [] },
      { "/work/backend": null },
      (fs) =>
        Effect.map(scanRepos(fs, "/work"), (repos) => {
          expect(repos[0]?.branch).toBeNull();
        })
    )
  );

  it.effect("names a nested repository by its project-relative path", () =>
    withFs(
      {
        "/work": ["apps"],
        "/work/apps": ["web"],
        "/work/apps/web": [],
      },
      { "/work/apps/web": "main" },
      (fs) =>
        Effect.map(scanRepos(fs, "/work"), (repos) => {
          expect(repos.map((repo) => repo.name)).toEqual(["apps/web"]);
        })
    )
  );

  it.effect("stops descending past the scan depth", () =>
    withFs(
      {
        "/work": ["a"],
        "/work/a": ["b"],
        "/work/a/b": ["deep"],
        "/work/a/b/deep": [],
      },
      { "/work/a/b/deep": "main" },
      (fs) =>
        Effect.map(scanRepos(fs, "/work"), (repos) => {
          expect(repos).toEqual([]);
        })
    )
  );

  it.effect("a project that is a repository holds exactly itself", () =>
    withFs(
      {
        "/work": ["packages"],
        "/work/packages": ["nested"],
        "/work/packages/nested": [],
      },
      { "/work": "main", "/work/packages/nested": "main" },
      (fs) =>
        Effect.map(scanRepos(fs, "/work"), (repos) => {
          expect(repos).toEqual([
            { name: "work", path: "/work", branch: "main" },
          ]);
        })
    )
  );

  it.effect("skips dot-directories and dependency folders", () =>
    withFs(
      {
        "/work": [".cache", "node_modules", "backend"],
        "/work/.cache": [],
        "/work/node_modules": [],
        "/work/backend": [],
      },
      {
        "/work/.cache": "main",
        "/work/node_modules": "main",
        "/work/backend": "main",
      },
      (fs) =>
        Effect.map(scanRepos(fs, "/work"), (repos) => {
          expect(repos.map((repo) => repo.name)).toEqual(["backend"]);
        })
    )
  );

  it.effect("is empty for a folder holding no repository", () =>
    withFs({ "/work": ["notes"], "/work/notes": [] }, {}, (fs) =>
      Effect.map(scanRepos(fs, "/work"), (repos) => {
        expect(repos).toEqual([]);
      })
    )
  );
});

describe("readBranch", () => {
  it.effect("follows a submodule's .git file to the real git directory", () =>
    Effect.flatMap(FileSystem.FileSystem, (fs) =>
      Effect.map(readBranch(fs, "/work/vendor"), (branch) => {
        expect(branch).toBe("main");
      })
    ).pipe(
      Effect.provide(
        FileSystem.layerNoop({
          stat: (path) =>
            String(path) === "/work/vendor/.git"
              ? Effect.succeed(info("File"))
              : missing(String(path)),
          readFileString: (path) => {
            const at = String(path);
            if (at === "/work/vendor/.git")
              return Effect.succeed("gitdir: /work/.git/modules/vendor\n");
            if (at === "/work/.git/modules/vendor/HEAD")
              return Effect.succeed("ref: refs/heads/main\n");
            return missing(at);
          },
        })
      )
    )
  );
});

describe("countRepos", () => {
  it.effect("counts the repositories under a folder", () =>
    withFs(
      {
        "/work": ["backend", "frontend"],
        "/work/backend": [],
        "/work/frontend": [],
      },
      { "/work/backend": "main", "/work/frontend": "main" },
      (fs) =>
        Effect.map(countRepos(fs, "/work"), (count) => {
          expect(count).toBe(2);
        })
    )
  );

  it.effect("is zero for an unreadable folder", () =>
    withFs({}, {}, (fs) =>
      Effect.map(countRepos(fs, "/nope"), (count) => {
        expect(count).toBe(0);
      })
    )
  );
});
