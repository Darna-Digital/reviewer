import {
  createBranch,
  deleteBranch,
  merge,
  rebase,
  renameBranch,
  summarize,
} from '../git/actions';
import { checkout } from '../git/refs';
import type { Branch } from '../git/refs';
import type { Review } from './useReview';

export type Branches = ReturnType<typeof useBranches>;

/** The branch actions, each run as a git round-trip with its notice. */
export function useBranches(review: Review) {
  const { root } = review;
  const current =
    review.branches.find((branch) => branch.current)?.name ?? 'HEAD';

  return {
    checkout: (branch: Branch) =>
      review.runGit(
        `Checking out ${branch.name}…`,
        () => checkout(root, branch, review.branches),
        (name) => `Checked out ${name}`,
      ),
    create: (name: string, from?: string) =>
      review.runGit(
        `Creating ${name}…`,
        () => createBranch(root, name, from),
        () => `Created and checked out ${name}`,
      ),
    merge: (branch: Branch) =>
      review.runGit(
        `Merging ${branch.name} into ${current}…`,
        () => merge(root, branch.name),
        (out) => summarize(out, `Merged ${branch.name}`),
      ),
    rebase: (branch: Branch) =>
      review.runGit(
        `Rebasing ${current} onto ${branch.name}…`,
        () => rebase(root, branch.name),
        () => `Rebased onto ${branch.name}`,
      ),
    rename: (branch: Branch, to: string) =>
      review.runGit(
        `Renaming ${branch.name}…`,
        () => renameBranch(root, branch.name, to),
        () => `Renamed to ${to}`,
      ),
    remove: (branch: Branch) =>
      review.runGit(
        `Deleting ${branch.name}…`,
        () => deleteBranch(root, branch.name),
        () => `Deleted ${branch.name}`,
      ),
  };
}
