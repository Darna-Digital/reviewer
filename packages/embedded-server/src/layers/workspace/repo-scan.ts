/**
 * Finding the git roots a project folder holds, and what each is checked out
 * on. The IDE equivalent is VCS root detection: you open a folder, and the tool
 * registers every repository under it rather than insisting the folder itself
 * be one.
 *
 * The branch is read out of `.git/HEAD` instead of spawned from `git`: the
 * workspace is read on nearly every interaction, and a folder holding a dozen
 * roots would otherwise pay a dozen processes each time. Parsing lives in core
 * (`parseHeadRef` / `parseGitDir`); this module only does the IO.
 */
import * as Effect from "effect/Effect";
import type * as FileSystem from "effect/FileSystem";
import { resolve as pathResolve } from "node:path";
import {
  parseGitDir,
  parseHeadRef,
  repoName,
  type RepoEntry,
} from "@byconvo/core/workspace";

/** How deep under a project folder a git root is still considered part of it. */
export const SCAN_DEPTH = 2;

const IGNORED = new Set(["node_modules", "target", "dist", "build", "vendor"]);

const skipped = (name: string): boolean =>
  name.startsWith(".") || IGNORED.has(name);

const orElse = <A>(effect: Effect.Effect<A, unknown>, fallback: A) =>
  effect.pipe(Effect.catch(() => Effect.succeed(fallback)));

/** Whether `dir` is a git root — `.git` as a directory, or a worktree's file. */
export const isGitRoot = (
  fs: FileSystem.FileSystem,
  dir: string
): Effect.Effect<boolean> => orElse(fs.exists(`${dir}/.git`), false);

/**
 * The branch `repoPath` is on, or null when HEAD is detached or unreadable.
 * A linked worktree or submodule keeps its `.git` as a file pointing at the
 * real git directory, so follow that before reading HEAD.
 */
export const readBranch = (
  fs: FileSystem.FileSystem,
  repoPath: string
): Effect.Effect<string | null> =>
  Effect.gen(function* () {
    const dotGit = `${repoPath}/.git`;
    const stat = yield* orElse(fs.stat(dotGit), null);
    if (stat === null) return null;
    const gitDir =
      stat.type === "Directory"
        ? dotGit
        : parseGitDir(yield* orElse(fs.readFileString(dotGit), ""));
    if (gitDir === null) return null;
    const head = yield* orElse(
      fs.readFileString(pathResolve(repoPath, gitDir, "HEAD")),
      ""
    );
    return parseHeadRef(head);
  });

/** The git roots inside `dir`, searched up to `depth` levels deep. */
const rootsUnder = (
  fs: FileSystem.FileSystem,
  dir: string,
  depth: number
): Effect.Effect<ReadonlyArray<string>> =>
  Effect.gen(function* () {
    const names = yield* orElse(fs.readDirectory(dir), [] as Array<string>);
    const roots: Array<string> = [];
    for (const name of [...names].sort((a, b) => a.localeCompare(b))) {
      if (skipped(name)) continue;
      const childPath = `${dir}/${name}`;
      const stat = yield* orElse(fs.stat(childPath), null);
      if (stat === null || stat.type !== "Directory") continue;
      if (yield* isGitRoot(fs, childPath)) {
        roots.push(childPath);
        continue;
      }
      if (depth > 1)
        roots.push(...(yield* rootsUnder(fs, childPath, depth - 1)));
    }
    return roots;
  });

/**
 * Every git root the project holds, named relative to it. A project that is
 * itself a repository holds exactly itself — nested roots below a repository
 * are its submodules or worktrees, which git already owns.
 */
export const scanRepos = (
  fs: FileSystem.FileSystem,
  project: string,
  depth = SCAN_DEPTH
): Effect.Effect<ReadonlyArray<RepoEntry>> =>
  Effect.gen(function* () {
    const paths = (yield* isGitRoot(fs, project))
      ? [project]
      : yield* rootsUnder(fs, project, depth);
    return yield* Effect.forEach(paths, (path) =>
      Effect.map(readBranch(fs, path), (branch) => ({
        name: repoName(project, path),
        path,
        branch,
      }))
    );
  });

/** How many git roots a folder holds — what makes it openable as a project. */
export const countRepos = (
  fs: FileSystem.FileSystem,
  dir: string,
  depth = SCAN_DEPTH
): Effect.Effect<number> =>
  Effect.map(rootsUnder(fs, dir, depth), (roots) => roots.length);
