/**
 * What the app knows about a repository's worktrees.
 *
 * A branch is checked out in at most one of them, so the pair (worktree,
 * branch) is one fact read two ways: asking where a branch lives and asking
 * what a worktree holds are the same question. That is what lets picking a
 * branch that is open elsewhere move focus there instead of failing a checkout
 * git will refuse.
 */
import type { Worktree } from "@byconvo/core/repo";

/** The worktree holding `branch`, or null when no worktree has it open. */
export const worktreeOf = (
  worktrees: ReadonlyArray<Worktree>,
  branch: string
): Worktree | null =>
  worktrees.find((worktree) => worktree.branch === branch) ?? null;

/**
 * Whether a branch is open somewhere other than where you are standing —
 * the case where checking it out would fail and focusing is what was meant.
 */
export const heldElsewhere = (
  worktrees: ReadonlyArray<Worktree>,
  branch: string
): Worktree | null => {
  const holder = worktreeOf(worktrees, branch);
  return holder === null || holder.isCurrent ? null : holder;
};

/**
 * Whether the worktree level is worth showing at all. One worktree is every
 * repository's starting state, and a control that permanently reads `main`
 * charges the hierarchy to everyone for the benefit of whoever is running two
 * tasks at once.
 */
export const isParallel = (worktrees: ReadonlyArray<Worktree>): boolean =>
  worktrees.length > 1;

/** Where a branch's work is aimed, from the recorded pairs. */
export const targetOf = (
  targets: ReadonlyArray<{ readonly branch: string; readonly target: string }>,
  branch: string | null
): string | null =>
  branch === null
    ? null
    : (targets.find((entry) => entry.branch === branch)?.target ?? null);

/**
 * The branches that could be opened in a worktree of their own: the ones no
 * worktree is already holding. Git refuses to check a branch out twice, so a
 * branch that is open somewhere is not an option here — it is a place to go,
 * which is what `heldElsewhere` answers.
 */
export const openableBranches = <A extends { readonly name: string }>(
  branches: ReadonlyArray<A>,
  worktrees: ReadonlyArray<Worktree>
): ReadonlyArray<A> => {
  const held = new Set(
    worktrees.flatMap((worktree) =>
      worktree.branch === null ? [] : [worktree.branch]
    )
  );
  return branches.filter((branch) => !held.has(branch.name));
};

/**
 * What to call the branch a prompt is about to run on.
 *
 * Nobody names a piece of work before writing it — the prompt is the name, so
 * the branch is taken from it rather than asked for. Kept to the opening few
 * words: a branch name is read in a list beside a dozen others, and the rest of
 * the sentence is in the session anyway.
 *
 * No folder in front of it. Every branch cut here would carry the same one,
 * which makes it a word that distinguishes nothing while costing five
 * characters in every list, trail and tooltip that ever shows the name.
 *
 * `taken` is every branch that already exists, including the ones no worktree
 * holds — git refuses to cut a branch twice, and the second prompt about the
 * same thing is exactly when that happens.
 */
const TASK_BRANCH_WORDS = 6;
const TASK_BRANCH_LENGTH = 40;

export const taskBranchName = (
  prompt: string,
  taken: ReadonlyArray<string>
): string => {
  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word.length > 0)
    .slice(0, TASK_BRANCH_WORDS)
    .join("-")
    .slice(0, TASK_BRANCH_LENGTH)
    .replace(/-+$/, "");
  const base = slug.length > 0 ? slug : "session";
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
};

/** Whether a typed name would open a branch that is already there, or cut one. */
export const opensExisting = (
  branches: ReadonlyArray<{ readonly name: string }>,
  typed: string
): boolean => branches.some((branch) => branch.name === typed.trim());
