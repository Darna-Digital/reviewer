/**
 * One list of things to review: the requests opened on this project — pull
 * requests on GitHub, merge requests on GitLab, one list either way.
 *
 * A review is a branch, the branch it lands on, and a state that says whether
 * it can land yet — so the rows are grouped under the base they share rather
 * than listed flat, which is what makes a stack of related work read as one
 * thing.
 */
import type { PullRequestInfo } from "@byconvo/core/ports/git-provider";
import {
  gitHostRequestRef,
  type GitHost,
} from "@byconvo/core/ports/git-remote";

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

/**
 * Everything the diff view can be pointed at, as one list.
 *
 * The changes in this checkout and a pull request from the cloud are two
 * answers to one question — *what am I looking at* — and the view that reads
 * them is the same view. Keeping them in one list is what lets the trail switch
 * between them in place, instead of making each a mode you have to leave the
 * other to reach.
 *
 * This checkout leads, because it is where you are standing.
 */
export type DiffSource = { readonly kind: "local" } | ReviewItem;

export const LOCAL_SOURCE: DiffSource = { kind: "local" };

export const diffSources = (
  pulls: ReadonlyArray<PullRequestInfo>
): ReadonlyArray<DiffSource> => [LOCAL_SOURCE, ...reviewItems(pulls)];

export const diffSourceKey = (source: DiffSource): string =>
  source.kind === "local" ? "local" : reviewKey(source);

/**
 * Reading your own changes is reviewing them, so it is called what it is called
 * everywhere else rather than described. The crumb beside it says what they are
 * read against, which is the part that varies.
 */
export const diffSourceLabel = (source: DiffSource): string =>
  source.kind === "local" ? "Review" : reviewTitle(source);

/**
 * The short prefix that says which of the two a row is without a word for it: a
 * request has a number, written the way its forge writes it, and the changes in
 * front of you need nothing.
 */
export const diffSourceHint = (
  source: DiffSource,
  host: GitHost
): string | null =>
  source.kind === "local" ? null : gitHostRequestRef(host, source.pull.number);
