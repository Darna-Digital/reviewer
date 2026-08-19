/**
 * Which repository a worktree belongs to.
 *
 * A linked worktree keeps `.git` as a file pointing at
 * `<main>/.git/worktrees/<name>`, so the original checkout is readable off disk
 * without asking git. Everything that has to agree across a repository's
 * worktrees — where a branch is aimed, which dev servers collide — is really
 * asking this one question.
 */
import * as Effect from "effect/Effect";
import type * as FileSystem from "effect/FileSystem";
import { mainRepoFromGitDir, parseGitDir } from "@byconvo/core/workspace";

export const mainRepoOf = (
  fs: FileSystem.FileSystem,
  repoPath: string
): Effect.Effect<string> =>
  Effect.gen(function* () {
    const dotGit = `${repoPath}/.git`;
    const stat = yield* Effect.orElseSucceed(fs.stat(dotGit), () => null);
    if (stat === null || stat.type === "Directory") return repoPath;
    const contents = yield* Effect.orElseSucceed(
      fs.readFileString(dotGit),
      () => ""
    );
    const gitDir = parseGitDir(contents);
    return (gitDir === null ? null : mainRepoFromGitDir(gitDir)) ?? repoPath;
  });
