import type { PullRequestInfo } from "@reviewer/core/ports/git-provider";

/**
 * `ref` value asking the log for every ref instead of one branch's ancestry.
 * Mirrors `ALL_REFS` in `@reviewer/core/repo`, which the server maps to
 * `git log --all`.
 */
export const ALL_REFS = "@all";

/** How a log ref reads in the UI — the sentinel gets a name, branches don't. */
export const logRefLabel = (ref: string): string =>
  ref === ALL_REFS ? "All branches" : ref;

export interface LogQuery {
  readonly author: string | null;
  readonly grep: string | null;
  readonly regex: boolean;
  readonly caseSensitive: boolean;
  readonly after: string | null;
  readonly before: string | null;
  /** Limit the log to commits touching this path — a single file's history. */
  readonly path: string | null;
  /** Trace `path` back through its renames (git's `--follow`). */
  readonly follow: boolean;
}

export const emptyLogQuery: LogQuery = {
  author: null,
  grep: null,
  regex: false,
  caseSensitive: false,
  after: null,
  before: null,
  path: null,
  follow: false,
};

/** The log query behind "show the history of this file". */
export const fileHistoryQuery = (path: string): LogQuery => ({
  ...emptyLogQuery,
  path,
  follow: true,
});

export type AppMode =
  | "commit"
  | "review"
  | "browse"
  | "chats"
  | "docs"
  | "tasks"
  | "comments"
  | "settings";

export type DiffTarget =
  | { readonly kind: "worktree" }
  /**
   * The branch as a whole, against what it is aimed at — everything since the
   * merge base, including work that is written but not yet committed.
   *
   * Uncommitted work is the point. An agent writes long before it commits, and
   * a review that stays empty until it does is empty for most of the time you
   * want to look.
   */
  | { readonly kind: "branch"; readonly target: string }
  | { readonly kind: "range"; readonly base: string; readonly head: string }
  | { readonly kind: "commit"; readonly sha: string; readonly shortSha: string }
  | { readonly kind: "pull"; readonly pull: PullRequestInfo };

export const diffTargetKey = (target: DiffTarget): string => {
  switch (target.kind) {
    case "worktree":
      return "worktree";
    case "branch":
      return `branch-${target.target}`;
    case "range":
      return `${target.base}...${target.head}`;
    case "commit":
      return `commit-${target.sha}`;
    case "pull":
      return `pr-${target.pull.number}`;
  }
};
