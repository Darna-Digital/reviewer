/**
 * The two decisions a task makes on its own, kept away from git so they can be
 * reasoned about: what a worktree's task is aimed at, and where its merge has
 * to happen.
 */
import type { LocalTask, Worktree } from "@byconvo/core/repo";

/**
 * What a task lands on. A branch that was aimed when its worktree was made says
 * so; one that was not falls back to whatever the original checkout is on,
 * which is what "merge it back" means when nobody said otherwise.
 */
export const baseOf = (
  targets: ReadonlyArray<{ readonly branch: string; readonly target: string }>,
  branch: string,
  mainBranch: string | null
): string | null =>
  targets.find((entry) => entry.branch === branch)?.target ??
  (mainBranch === branch ? null : mainBranch);

/** The worktrees that are somebody's task: not the original, and on a branch. */
export const taskWorktrees = (
  worktrees: ReadonlyArray<Worktree>
): ReadonlyArray<Worktree & { readonly branch: string }> =>
  worktrees.flatMap((worktree) =>
    worktree.isMain || worktree.branch === null
      ? []
      : [{ ...worktree, branch: worktree.branch }]
  );

/**
 * Where merging a task has to run.
 *
 * Git will not move a branch that a worktree is sitting on, so a base that is
 * checked out somewhere has to be merged *in* that somewhere. A base nobody
 * holds has no such tree to disturb and can be moved by updating the ref alone
 * — which is what lets a merge happen without the app going anywhere.
 *
 * Both are only reachable once the base is already an ancestor. Until then the
 * merge would need a commit of its own, and the honest place to make it is the
 * task's own worktree, where whoever is working on it can settle the conflicts.
 */
export type MergeRoute =
  | { readonly kind: "behind"; readonly base: string }
  | { readonly kind: "in-worktree"; readonly path: string }
  | { readonly kind: "ref-only" };

export const mergeRoute = (
  task: Pick<LocalTask, "base" | "upToDate">,
  worktrees: ReadonlyArray<Worktree>
): MergeRoute => {
  if (!task.upToDate) return { kind: "behind", base: task.base };
  const holder = worktrees.find((worktree) => worktree.branch === task.base);
  return holder === undefined
    ? { kind: "ref-only" }
    : { kind: "in-worktree", path: holder.path };
};
