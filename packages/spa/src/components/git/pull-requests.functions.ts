/**
 * The order the review sidebar reads in: pull requests gathered under the branch
 * they target, the branches alphabetical, each group keeping the order GitHub
 * listed them in.
 *
 * Held apart from the list because two things need it. The list draws it, and
 * review mode opens on the first pull request there is — and "the first" has to
 * mean the row at the top of the sidebar, or the window opens on one thing while
 * pointing at another.
 */
import type { PullRequestInfo } from "@byconvo/core/ports/git-provider";

export interface PullRequestGroup {
  readonly base: string;
  readonly pulls: ReadonlyArray<PullRequestInfo>;
}

export function groupPullsByBase(
  pulls: ReadonlyArray<PullRequestInfo>
): ReadonlyArray<PullRequestGroup> {
  return [...new Set(pulls.map((pull) => pull.baseRef))].sort().map((base) => ({
    base,
    pulls: pulls.filter((pull) => pull.baseRef === base),
  }));
}

/** The one review mode opens on, or null when there is nothing to review. */
export function firstPullRequest(
  pulls: ReadonlyArray<PullRequestInfo>
): PullRequestInfo | null {
  return groupPullsByBase(pulls)[0]?.pulls[0] ?? null;
}
