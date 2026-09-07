/**
 * SQLite-backed store for where each branch's work is aimed.
 *
 * Scoped to the selected repository, so a project holding several roots keeps
 * each root's aims to itself — two repositories may well both have a `main`,
 * and a row written in one must not answer for the other.
 */
import * as Effect from "effect/Effect";
import { attempt } from "../db/db.service.ts";
import { allRows, execute, oneRow } from "../db/database.ts";
import { WorkspaceContext } from "../workspace/workspace-context.ts";
import type { BranchTarget } from "@reviewer/core/repo";
import type { BranchTargetsRepo } from "@reviewer/core/branch-targets";

interface TargetRow {
  readonly branch: string;
  readonly target: string;
}

export const makeSqliteBranchTargetsRepository = Effect.gen(function* () {
  const ctx = yield* WorkspaceContext;

  const inRepo = <A>(f: (repoPath: string) => A) =>
    Effect.flatMap(ctx.requireCurrent, (repoPath) =>
      attempt(() => f(repoPath))
    );

  const list: BranchTargetsRepo["list"] = inRepo((repoPath) =>
    allRows<TargetRow>(
      "SELECT branch, target FROM branch_target WHERE repo_path = ? ORDER BY branch",
      repoPath
    ).map((row): BranchTarget => ({ branch: row.branch, target: row.target }))
  );

  const get: BranchTargetsRepo["get"] = (branch) =>
    inRepo((repoPath) => {
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
    inRepo((repoPath) => {
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
    inRepo((repoPath) => {
      execute(
        "DELETE FROM branch_target WHERE repo_path = ? AND branch = ?",
        repoPath,
        branch
      );
    });

  return { list, get, set, remove } satisfies BranchTargetsRepo;
});
