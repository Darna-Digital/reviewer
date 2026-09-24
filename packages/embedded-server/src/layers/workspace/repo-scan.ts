/**
 * Finding the git repositories a machine holds, and what each is checked out
 * on — the walk behind the opener's list.
 *
 * The walk starts at the home folder and steps down through ordinary folders,
 * stopping at each repository it finds (what lies under one — submodules,
 * vendored checkouts — is git's), and never entering the folders that hold
 * no projects of the user's own: the system's `Library`, dependency and build
 * output, anything hidden. Node's own `readdir` with file types is used
 * rather than Effect's FileSystem because it answers "is this a directory, a
 * symlink" from the directory entry itself, which on a home folder of tens
 * of thousands of entries is the difference between one call and two per
 * entry — symlinks are never followed, so a loop cannot be walked into.
 *
 * The branch is read out of `.git/HEAD` instead of spawned from `git`, since
 * a scan visits every repository and would otherwise pay a process for each.
 * Parsing lives in core (`parseHeadRef` / `parseGitDir`); this module only
 * does the IO.
 */
import * as Effect from "effect/Effect";
import { readdir, readFile, stat } from "node:fs/promises";
import { resolve as pathResolve } from "node:path";
import {
  folderName,
  parseGitDir,
  parseHeadRef,
  type RepoEntry,
} from "@reviewer/core/workspace";

/** How deep under the start folder a repository is still looked for. */
export const SCAN_DEPTH = 8;

/** Folders never stepped into: no repository of the user's own is under them. */
const SKIPPED_NAMES = new Set([
  "node_modules",
  "target",
  "dist",
  "build",
  "out",
  "vendor",
  "Pods",
  "DerivedData",
  "Library",
  "Applications",
  "Music",
  "Movies",
  "Pictures",
  "Public",
  "go",
  "bower_components",
  "__pycache__",
  "venv",
]);

const skipped = (name: string): boolean =>
  name.startsWith(".") || SKIPPED_NAMES.has(name);

const orElse = <A>(promise: Promise<A>, fallback: A): Promise<A> =>
  promise.catch(() => fallback);

/** Whether `dir` is a git root — `.git` as a directory, or a submodule's file. */
export const isGitRoot = (dir: string): Effect.Effect<boolean> =>
  Effect.promise(() =>
    orElse(
      stat(`${dir}/.git`).then(() => true),
      false
    )
  );

/**
 * The branch `repoPath` is on, or null when HEAD is detached or unreadable.
 * A submodule or worktree keeps its `.git` as a file pointing at the real git
 * directory, so follow that before reading HEAD.
 */
export const readBranch = (repoPath: string): Effect.Effect<string | null> =>
  Effect.promise(async () => {
    const dotGit = `${repoPath}/.git`;
    const info = await orElse(stat(dotGit), null);
    if (info === null) return null;
    const gitDir = info.isDirectory()
      ? dotGit
      : parseGitDir(await orElse(readFile(dotGit, "utf8"), ""));
    if (gitDir === null) return null;
    const head = await orElse(
      readFile(pathResolve(repoPath, gitDir, "HEAD"), "utf8"),
      ""
    );
    return parseHeadRef(head);
  });

/** The repository at `path`, its branch read alongside. */
export const readRepo = (path: string): Effect.Effect<RepoEntry> =>
  Effect.map(readBranch(path), (branch) => ({
    name: folderName(path),
    path,
    branch,
    lastOpened: null,
  }));

/** How many folders are walked at once; bounded so a wide tree cannot exhaust file descriptors. */
const SCAN_CONCURRENCY = 16;

/**
 * Walk `start` for repositories, handing each one to `found` as it turns up
 * so a listing can fill in while the walk is still under way. Folders are
 * visited in name order and reported as they are reached, so the same
 * machine yields the same order twice.
 */
export const scanRepos = (
  start: string,
  found: (repo: RepoEntry) => Effect.Effect<void>,
  depth = SCAN_DEPTH
): Effect.Effect<void> =>
  Effect.gen(function* () {
    if (yield* isGitRoot(start)) {
      yield* found(yield* readRepo(start));
      return;
    }
    if (depth === 0) return;
    const entries = yield* Effect.promise(() =>
      orElse(readdir(start, { withFileTypes: true }), [])
    );
    const folders = entries
      .filter((entry) => entry.isDirectory() && !skipped(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
    yield* Effect.forEach(
      folders,
      (name) => scanRepos(`${start}/${name}`, found, depth - 1),
      { concurrency: SCAN_CONCURRENCY, discard: true }
    );
  });
