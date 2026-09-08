/**
 * One list of things to review: the pull requests opened on this project.
 *
 * A review is a branch, the branch it lands on, and a state that says whether
 * it can land yet — so the rows are grouped under the base they share rather
 * than listed flat, which is what makes a stack of related work read as one
 * thing.
 */
import type { PullRequestInfo } from "@reviewer/core/ports/git-provider";

export type ReviewItem = {
  readonly kind: "pull";
  readonly pull: PullRequestInfo;
};

export const reviewKey = (item: ReviewItem): string =>
  `pull:${item.pull.number}`;

export const reviewBase = (item: ReviewItem): string => item.pull.baseRef;

export const reviewBranch = (item: ReviewItem): string => item.pull.headRef;

export const reviewTitle = (item: ReviewItem): string => item.pull.title;

export const reviewAuthor = (item: ReviewItem): string => item.pull.author;

export const reviewUpdatedAt = (item: ReviewItem): string =>
  item.pull.updatedAt;

const byNewestFirst = (a: ReviewItem, b: ReviewItem): number =>
  reviewUpdatedAt(b).localeCompare(reviewUpdatedAt(a));

export const reviewItems = (
  pulls: ReadonlyArray<PullRequestInfo>
): ReadonlyArray<ReviewItem> =>
  pulls.map((pull): ReviewItem => ({ kind: "pull", pull })).sort(byNewestFirst);

export interface ReviewGroup {
  readonly base: string;
  readonly items: ReadonlyArray<ReviewItem>;
}

export const groupReviewsByBase = (
  items: ReadonlyArray<ReviewItem>
): ReadonlyArray<ReviewGroup> =>
  [...new Set(items.map(reviewBase))].sort().map((base) => ({
    base,
    items: items.filter((item) => reviewBase(item) === base),
  }));
