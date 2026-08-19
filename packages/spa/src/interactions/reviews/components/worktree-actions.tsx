/**
 * What a worktree's endings are called before they happen.
 *
 * Merging and discarding both take a directory away, and a directory somebody's
 * agent has been working in is not a thing to remove on one click. Both are
 * asked in the words that decide it — whether the commits survive — rather than
 * in a generic "are you sure", which is a question nobody reads.
 */
import type { LocalTask } from "@byconvo/core/repo";

/**
 * Said before the merge rather than after: uncommitted work in the worktree is
 * about to stop existing, and a warning that arrives once the directory is gone
 * is not a warning.
 */
export const mergeWarning = (worktree: LocalTask): string | null =>
  worktree.dirty
    ? `‘${worktree.branch}’ has uncommitted changes. Merging takes its commits and retires the worktree — anything not committed goes with it.`
    : null;

/**
 * What discarding will actually do, in the words that matter: whether the
 * commits survive. Asked every time, because the answer changes — a worktree
 * that committed something keeps its branch, and one that never did takes the
 * branch with it.
 */
export const discardWarning = (worktree: LocalTask): string =>
  worktree.ahead > 0
    ? `Discard the worktree for ‘${worktree.branch}’? Its ${worktree.ahead} commit${worktree.ahead === 1 ? "" : "s"} stay on the branch — only the directory and its services go.${worktree.dirty ? " Uncommitted changes there will be lost." : ""}`
    : `Discard ‘${worktree.branch}’? It has no commits, so the worktree and the branch both go.${worktree.dirty ? " Uncommitted changes there will be lost." : ""}`;
