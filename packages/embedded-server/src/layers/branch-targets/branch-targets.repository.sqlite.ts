/**
 * SQLite-backed store for where each branch's work is aimed.
 *
 * Scoped to the repository's *main* worktree rather than to the selected one.
 * A branch aimed at `development` is aimed there whether you ask from its own
 * worktree or from the original one, and a row written in one that could not be
 * read from the other would make the same branch answer two ways.
 *
 * The main checkout is read off disk rather than out of git: a linked worktree
 * keeps `.git` as a file pointing at `<main>/.git/worktrees/<name>`, which is
 * the whole answer, and no store should spawn a process to scope a row.
 */
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { mainRepoOf } from "../workspace/main-repo.ts";
import { attempt } from "../db/db.service.ts";
import { allRows, execute, oneRow } from "../db/database.ts";
import { WorkspaceContext } from "../workspace/workspace-context.ts";
import type { BranchTarget } from "@byconvo/core/repo";
import type { BranchTargetsRepo } from "@byconvo/core/branch-targets";

interface TargetRow {
  readonly branch: string;
  readonly target: string;
}

export const makeSqliteBranchTargetsRepository = Effect.gen(function* () {
  const ctx = yield* WorkspaceContext;
  const fs = yield* FileSystem.FileSystem;

  const mainRepo = Effect.flatMap(ctx.requireCurrent, (selected) =>
    mainRepoOf(fs, selected)
  );

  const inMainRepo = <A>(f: (repoPath: string) => A) =>
    Effect.flatMap(mainRepo, (repoPath) => attempt(() => f(repoPath)));

  const list: BranchTargetsRepo["list"] = inMainRepo((repoPath) =>
    allRows<TargetRow>(
      "SELECT branch, target FROM branch_target WHERE repo_path = ? ORDER BY branch",
      repoPath
    ).map((row): BranchTarget => ({ branch: row.branch, target: row.target }))
  );

  const get: BranchTargetsRepo["get"] = (branch) =>
    inMainRepo((repoPath) => {
      const row = oneRow<TargetRow>(
        "SELECT branch, target FROM branch_target WHERE repo_path = ? AND branch = ?",
        repoPath,
        branch
      );
      return row === undefined
        ? null
        : { branch: row.branch, target: row.target };
    });

  const set: BranchTargetsRepo["set"] = (branch, target) =>
    inMainRepo((repoPath) => {
      execute(
        `INSERT INTO branch_target (repo_path, branch, target)
         VALUES (?, ?, ?)
         ON CONFLICT (repo_path, branch) DO UPDATE SET target = excluded.target`,
        repoPath,
        branch,
        target
      );
      return { branch, target };
    });

  const remove: BranchTargetsRepo["remove"] = (branch) =>
    inMainRepo((repoPath) => {
      execute(
        "DELETE FROM branch_target WHERE repo_path = ? AND branch = ?",
        repoPath,
        branch
      );
    });

  return { list, get, set, remove } satisfies BranchTargetsRepo;
});
