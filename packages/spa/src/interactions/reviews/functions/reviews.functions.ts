/**
 * One list of things to review, whether the work happened on someone's machine
 * in the cloud or in a worktree beside this one.
 *
 * A pull request and a worktree are the same shape of thing — a branch, the
 * branch it lands on, and a state that says whether it can land yet — so they
 * are grouped under the base they share rather than kept in two lists that
 * would have to be scanned separately. Where the work ran is a badge on the
 * row, and a filter for whoever only wants one of the two.
 */
import type { PullRequestInfo } from "@byconvo/core/ports/git-provider";
import type { LocalTask } from "@byconvo/core/repo";

export type ReviewItem =
  | { readonly kind: "pull"; readonly pull: PullRequestInfo }
  | { readonly kind: "worktree"; readonly worktree: LocalTask };

export const reviewKey = (item: ReviewItem): string =>
  item.kind === "pull"
    ? `pull:${item.pull.number}`
    : `worktree:${item.worktree.branch}`;

export const reviewBase = (item: ReviewItem): string =>
  item.kind === "pull" ? item.pull.baseRef : item.worktree.base;

export const reviewBranch = (item: ReviewItem): string =>
  item.kind === "pull" ? item.pull.headRef : item.worktree.branch;

export const reviewTitle = (item: ReviewItem): string =>
  item.kind === "pull" ? item.pull.title : item.worktree.subject;

export const reviewAuthor = (item: ReviewItem): string =>
  item.kind === "pull" ? item.pull.author : item.worktree.author;

export const reviewUpdatedAt = (item: ReviewItem): string =>
  item.kind === "pull" ? item.pull.updatedAt : item.worktree.updatedAt;

/**
 * What a worktree is waiting on, as one word — the same job a pull request's
 * open/draft/conflicted state does.
 *
 * Ordered by what stops you first: work that was never committed cannot be
 * merged, a branch behind its base cannot be merged either, and uncommitted
 * leftovers are worth saying out loud because merging would leave them behind.
 * None of them stops it being *read* — the diff shows what is on disk in the
 * worktree either way.
 */
export type WorktreeState = "working" | "behind" | "uncommitted" | "ready";

export const worktreeState = (worktree: LocalTask): WorktreeState => {
  if (worktree.ahead === 0) return "working";
  if (!worktree.upToDate) return "behind";
  return worktree.dirty ? "uncommitted" : "ready";
};

export const WORKTREE_STATE_LABEL: Readonly<Record<WorktreeState, string>> = {
  working: "No commits yet",
  behind: "Behind base",
  uncommitted: "Uncommitted changes",
  ready: "Ready to merge",
};

/** Only a worktree that has commits and is not behind can actually be landed. */
export const isMergeable = (worktree: LocalTask): boolean =>
  worktree.ahead > 0 && worktree.upToDate;

const byNewestFirst = (a: ReviewItem, b: ReviewItem): number =>
  reviewUpdatedAt(b).localeCompare(reviewUpdatedAt(a));

/**
 * Worktrees lead their group. They are the work you started and the only rows
 * here you can act on without leaving, so burying them under a stranger's pull
 * requests by date would hide the thing you came to find.
 */
export const reviewItems = (
  pulls: ReadonlyArray<PullRequestInfo>,
  worktrees: ReadonlyArray<LocalTask>
): ReadonlyArray<ReviewItem> => [
  ...worktrees
    .map((worktree): ReviewItem => ({ kind: "worktree", worktree }))
    .sort(byNewestFirst),
  ...pulls
    .map((pull): ReviewItem => ({ kind: "pull", pull }))
    .sort(byNewestFirst),
];

/** Which of the two kinds the list is narrowed to, if either. */
export type ReviewFilter = "all" | "worktree" | "pull";

export const REVIEW_FILTERS: ReadonlyArray<ReviewFilter> = [
  "all",
  "worktree",
  "pull",
];

export const REVIEW_FILTER_LABEL: Readonly<Record<ReviewFilter, string>> = {
  all: "All",
  worktree: "Worktrees",
  pull: "Pull requests",
};

export const filterReviewKind = (
  items: ReadonlyArray<ReviewItem>,
  filter: ReviewFilter
): ReadonlyArray<ReviewItem> =>
  filter === "all" ? items : items.filter((item) => item.kind === filter);

/** How many rows each tab would show, so a tab can say so before it is picked. */
export const reviewFilterCount = (
  items: ReadonlyArray<ReviewItem>,
  filter: ReviewFilter
): number => filterReviewKind(items, filter).length;

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
 * The main worktree, a worktree cut beside it and a pull request from the
 * cloud are three answers to one question — *what am I looking at* — and the
 * view that reads them is the same view. Keeping them in one list is what lets
 * the trail switch between them in place, instead of making each a mode you
 * have to leave the others to reach.
 *
 * The main worktree leads, because it is where you are standing.
 */
export type DiffSource = { readonly kind: "local" } | ReviewItem;

export const LOCAL_SOURCE: DiffSource = { kind: "local" };

export const diffSources = (
  pulls: ReadonlyArray<PullRequestInfo>,
  worktrees: ReadonlyArray<LocalTask>
): ReadonlyArray<DiffSource> => [LOCAL_SOURCE, ...reviewItems(pulls, worktrees)];

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
 * The short prefix that says which of the three a row is without a word for it:
 * a pull request has a number, a worktree has where it lands, and the changes
 * in front of you need neither.
 */
export const diffSourceHint = (source: DiffSource): string | null => {
  if (source.kind === "local") return null;
  return source.kind === "pull"
    ? `#${source.pull.number}`
    : `→ ${source.worktree.base}`;
};
