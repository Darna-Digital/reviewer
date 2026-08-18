import * as Schema from "effect/Schema";

export const GitFileStatus = Schema.Literals([
  "added",
  "deleted",
  "ignored",
  "modified",
  "renamed",
  "untracked",
]);
export type GitFileStatus = typeof GitFileStatus.Type;
export const GitStatusEntry = Schema.Struct({
  path: Schema.String,
  status: GitFileStatus,
});
export type GitStatusEntry = typeof GitStatusEntry.Type;
export const GitHubRemote = Schema.Struct({
  owner: Schema.String,
  repo: Schema.String,
});
export type GitHubRemote = typeof GitHubRemote.Type;
export const RepoInfo = Schema.Struct({
  root: Schema.String,
  name: Schema.String,
  currentBranch: Schema.String,
  remoteUrl: Schema.NullOr(Schema.String),
  github: Schema.NullOr(GitHubRemote),
});
export type RepoInfo = typeof RepoInfo.Type;
export const BranchInfo = Schema.Struct({
  name: Schema.String,
  sha: Schema.String,
  isCurrent: Schema.Boolean,
  upstream: Schema.NullOr(Schema.String),
  ahead: Schema.Number,
  behind: Schema.Number,
  committedAt: Schema.String,
  subject: Schema.String,
});
export type BranchInfo = typeof BranchInfo.Type;
/**
 * One checkout of the repository — the main working tree, or a linked one git
 * keeps elsewhere on disk. A branch is checked out in at most one of them, so
 * the pair (worktree, branch) is what actually says where work lands.
 */
export const Worktree = Schema.Struct({
  path: Schema.String,
  /** The leaf folder the checkout lives in — what a picker shows. */
  name: Schema.String,
  /** Null when the checkout is on a detached HEAD. */
  branch: Schema.NullOr(Schema.String),
  /** The repository's original checkout, the one `.git` lives in. */
  isMain: Schema.Boolean,
  /** The checkout the app currently has open. */
  isCurrent: Schema.Boolean,
});
export type Worktree = typeof Worktree.Type;

/**
 * Open a branch in a worktree of its own. No path is given: a worktree is not
 * something anyone asks for by name, it is where a branch had to go, so the
 * directory is derived from the branch and the caller never sees it.
 */
export const NewWorktree = Schema.Struct({
  branch: Schema.String,
  /** The branch the work is aimed at — and cut from, when it is a new branch. */
  target: Schema.optionalKey(Schema.String),
});
export type NewWorktree = typeof NewWorktree.Type;
export const RemoveWorktree = Schema.Struct({
  path: Schema.String,
  /** Retire it even though the worktree still holds uncommitted work. */
  force: Schema.optionalKey(Schema.Boolean),
});
export type RemoveWorktree = typeof RemoveWorktree.Type;

/**
 * Where a branch's work is aimed. Git has no such notion — a branch knows its
 * tip and its upstream, never what it is meant to land on — so the answer is
 * recorded once, when the branch is made, and every diff of that branch is read
 * against it.
 *
 * Kept per branch rather than per worktree: a branch aimed at `development` is
 * aimed there whether it is read from its own worktree or from the main one.
 */
export const BranchTarget = Schema.Struct({
  branch: Schema.String,
  target: Schema.String,
});
export type BranchTarget = typeof BranchTarget.Type;
export const SetBranchTarget = Schema.Struct({
  branch: Schema.String,
  target: Schema.String,
});
export type SetBranchTarget = typeof SetBranchTarget.Type;

/**
 * A piece of work running in a worktree of its own, read the way a pull request
 * is read: a branch, the branch it lands on, and what stands between them.
 *
 * The point of the shape is that you never have to go to it. Everything here is
 * answerable from any checkout of the repository — refs are shared — so a task
 * can be listed, reviewed and merged while the app stays where it is. That is
 * the whole difference between this and a worktree switcher.
 */
export const LocalTask = Schema.Struct({
  branch: Schema.String,
  /** The branch this lands on. Falls back to the main worktree's own branch. */
  base: Schema.String,
  /** Where the work is happening — needed to update it, and to retire it. */
  path: Schema.String,
  name: Schema.String,
  /** Commits the branch has that the base does not. */
  ahead: Schema.Number,
  /**
   * Whether the base is already an ancestor, which is exactly the question of
   * whether merging is a fast-forward — and so whether it can happen without
   * checking anything out.
   */
  upToDate: Schema.Boolean,
  /** Uncommitted work in the worktree, which no merge would carry across. */
  dirty: Schema.Boolean,
  /** The last commit's subject — a task's title, the way a PR has one. */
  subject: Schema.String,
  author: Schema.String,
  updatedAt: Schema.String,
});
export type LocalTask = typeof LocalTask.Type;

export const TaskRef = Schema.Struct({ branch: Schema.String });
export type TaskRef = typeof TaskRef.Type;

/**
 * A merge, and where to land it. `base` absent means what the branch is already
 * aimed at; naming one re-aims it, so what it is ahead by is judged against the
 * branch it is actually going to.
 */
export const MergeTaskRef = Schema.Struct({
  branch: Schema.String,
  base: Schema.optional(Schema.String),
});
export type MergeTaskRef = typeof MergeTaskRef.Type;

/** A commit made in a worktree rather than in the checkout you are standing in. */
export const TaskCommit = Schema.Struct({
  branch: Schema.String,
  message: Schema.String,
  /** Empty commits everything, as the commit panel here does. */
  paths: Schema.optional(Schema.Array(Schema.String)),
});
export type TaskCommit = typeof TaskCommit.Type;

/**
 * A merge that declined to happen is an answer, not a failure — a task behind
 * its base needs updating, which is something to be told, not an error to be
 * decoded out of git's stderr.
 */
export const MergeOutcome = Schema.Struct({
  merged: Schema.Boolean,
  reason: Schema.NullOr(Schema.String),
});
export type MergeOutcome = typeof MergeOutcome.Type;

export const RemoteBranchInfo = Schema.Struct({
  name: Schema.String,
  remote: Schema.String,
  shortName: Schema.String,
  sha: Schema.String,
  committedAt: Schema.String,
  subject: Schema.String,
});
export type RemoteBranchInfo = typeof RemoteBranchInfo.Type;
export const CommitInfo = Schema.Struct({
  sha: Schema.String,
  shortSha: Schema.String,
  author: Schema.String,
  authoredAt: Schema.String,
  subject: Schema.String,
  refs: Schema.Array(Schema.String),
  parents: Schema.Array(Schema.String),
});
export type CommitInfo = typeof CommitInfo.Type;
export const CommitFileChange = Schema.Struct({
  path: Schema.String,
  status: GitFileStatus,
  oldPath: Schema.NullOr(Schema.String),
});
export type CommitFileChange = typeof CommitFileChange.Type;
export const CommitDetail = Schema.Struct({
  sha: Schema.String,
  shortSha: Schema.String,
  author: Schema.String,
  authorEmail: Schema.String,
  authoredAt: Schema.String,
  subject: Schema.String,
  body: Schema.String,
  refs: Schema.Array(Schema.String),
  parents: Schema.Array(Schema.String),
  files: Schema.Array(CommitFileChange),
});
export type CommitDetail = typeof CommitDetail.Type;
export const FilesPayload = Schema.Struct({
  paths: Schema.Array(Schema.String),
  gitStatus: Schema.Array(GitStatusEntry),
});
export type FilesPayload = typeof FilesPayload.Type;
export const ContentMatch = Schema.Struct({
  path: Schema.String,
  line: Schema.Number,
  column: Schema.Number,
  text: Schema.String,
});
export type ContentMatch = typeof ContentMatch.Type;
export const ContentMatches = Schema.Struct({
  matches: Schema.Array(ContentMatch),
  /** More matches existed than the query's limit allowed through. */
  truncated: Schema.Boolean,
});
export type ContentMatches = typeof ContentMatches.Type;
export const SearchQueryParams = Schema.Struct({
  q: Schema.String,
  case: Schema.optionalKey(Schema.String),
  word: Schema.optionalKey(Schema.String),
  regex: Schema.optionalKey(Schema.String),
  limit: Schema.optionalKey(Schema.String),
});
export type SearchQueryParams = typeof SearchQueryParams.Type;
export const RepoStatus = Schema.Struct({
  branch: Schema.String,
  upstream: Schema.NullOr(Schema.String),
  ahead: Schema.Number,
  behind: Schema.Number,
  headSha: Schema.String,
  changed: Schema.Number,
  staged: Schema.Number,
  unstaged: Schema.Number,
  untracked: Schema.Number,
  conflicted: Schema.Number,
});
export type RepoStatus = typeof RepoStatus.Type;
export const CommandOutput = Schema.Struct({ output: Schema.String });
export type CommandOutput = typeof CommandOutput.Type;
export const CommitResult = Schema.Struct({ sha: Schema.String });
export type CommitResult = typeof CommitResult.Type;
export const ConflictKind = Schema.Literals([
  "both-modified",
  "both-added",
  "both-deleted",
  "added-by-us",
  "added-by-them",
  "deleted-by-us",
  "deleted-by-them",
]);
export type ConflictKind = typeof ConflictKind.Type;
export const ConflictedFile = Schema.Struct({
  path: Schema.String,
  kind: ConflictKind,
});
export type ConflictedFile = typeof ConflictedFile.Type;
export const MergeOperation = Schema.Literals([
  "merge",
  "rebase",
  "cherry-pick",
  "revert",
  "none",
]);
export type MergeOperation = typeof MergeOperation.Type;
export const MergeState = Schema.Struct({
  operation: MergeOperation,
  incoming: Schema.NullOr(Schema.String),
  onto: Schema.NullOr(Schema.String),
  conflicted: Schema.Array(ConflictedFile),
});
export type MergeState = typeof MergeState.Type;
export const ConflictBlobs = Schema.Struct({
  path: Schema.String,
  base: Schema.NullOr(Schema.String),
  ours: Schema.String,
  theirs: Schema.String,
});
export type ConflictBlobs = typeof ConflictBlobs.Type;
export const LogQueryParams = Schema.Struct({
  ref: Schema.optionalKey(Schema.String),
  limit: Schema.optionalKey(Schema.String),
  skip: Schema.optionalKey(Schema.String),
  author: Schema.optionalKey(Schema.String),
  grep: Schema.optionalKey(Schema.String),
  regex: Schema.optionalKey(Schema.String),
  case: Schema.optionalKey(Schema.String),
  after: Schema.optionalKey(Schema.String),
  before: Schema.optionalKey(Schema.String),
  path: Schema.optionalKey(Schema.String),
  follow: Schema.optionalKey(Schema.String),
});
export type LogQueryParams = typeof LogQueryParams.Type;
export const DiffQuery = Schema.Struct({
  commit: Schema.optionalKey(Schema.String),
  base: Schema.optionalKey(Schema.String),
  head: Schema.optionalKey(Schema.String),
  /** The branch the working tree is read against, uncommitted work included. */
  target: Schema.optionalKey(Schema.String),
  /**
   * A task's branch — read the diff in that task's own worktree instead of
   * here. Paired with `target`, which names the branch it is read against;
   * without one the task's own base answers.
   */
  task: Schema.optionalKey(Schema.String),
});
export type DiffQuery = typeof DiffQuery.Type;
export const DiffFileQuery = Schema.Struct({
  path: Schema.String,
  prevPath: Schema.optionalKey(Schema.String),
  commit: Schema.optionalKey(Schema.String),
  base: Schema.optionalKey(Schema.String),
  head: Schema.optionalKey(Schema.String),
  target: Schema.optionalKey(Schema.String),
  task: Schema.optionalKey(Schema.String),
});
export type DiffFileQuery = typeof DiffFileQuery.Type;
export const DiffFileContents = Schema.Struct({
  oldContents: Schema.NullOr(Schema.String),
  newContents: Schema.NullOr(Schema.String),
});
export type DiffFileContents = typeof DiffFileContents.Type;
export const CommitParam = Schema.Struct({ sha: Schema.String });
export const Checkout = Schema.Struct({ branch: Schema.String });
export type Checkout = typeof Checkout.Type;
export const CommitBody = Schema.Struct({
  message: Schema.String,
  paths: Schema.optionalKey(Schema.Array(Schema.String)),
});
export type CommitBody = typeof CommitBody.Type;
export const Discard = Schema.Struct({
  paths: Schema.Array(Schema.String),
});
export type Discard = typeof Discard.Type;
export const DiscardHunk = Schema.Struct({
  path: Schema.String,
  hunkIndex: Schema.Int,
});
export type DiscardHunk = typeof DiscardHunk.Type;
export const Merge = Schema.Struct({ branch: Schema.String });
export type Merge = typeof Merge.Type;
export const Rebase = Schema.Struct({ onto: Schema.String });
export type Rebase = typeof Rebase.Type;
export const ConflictParam = Schema.Struct({ path: Schema.String });
export type ConflictParam = typeof ConflictParam.Type;
export const ResolveConflict = Schema.Struct({
  path: Schema.String,
  resolution: Schema.Literals(["ours", "theirs", "content"]),
});
export type ResolveConflict = typeof ResolveConflict.Type;
export const CreateBranch = Schema.Struct({
  name: Schema.String,
  startPoint: Schema.optionalKey(Schema.String),
});
export type CreateBranch = typeof CreateBranch.Type;
export const RenameBranch = Schema.Struct({
  from: Schema.String,
  to: Schema.String,
});
export type RenameBranch = typeof RenameBranch.Type;
export const DeleteBranch = Schema.Struct({
  name: Schema.String,
  force: Schema.optionalKey(Schema.Boolean),
});
export type DeleteBranch = typeof DeleteBranch.Type;
/**
 * Which diff a full-file-contents lookup belongs to — mirrors the `/diff`
 * query, so both sides of the file resolve against the same refs the diff
 * itself was generated from.
 */
export type DiffFileTarget =
  | { readonly kind: "worktree" }
  | { readonly kind: "commit"; readonly sha: string }
  | { readonly kind: "range"; readonly base: string; readonly head: string }
  /**
   * The branch as a whole, against what it is aimed at: the merge base on the
   * old side and the working tree on the new one, so work that is written but
   * not yet committed still reads as part of the branch.
   */
  | { readonly kind: "branch"; readonly target: string }
  /**
   * The same two sides, read in a task's own worktree rather than this one —
   * which is the only way to see work an agent has written but not committed.
   */
  | {
      readonly kind: "task";
      readonly branch: string;
      readonly base: string | null;
    };

/**
 * Sentinel `LogQuery.ref` asking for every ref (local, remote and tags) instead
 * of one branch's ancestry — git's `--all`. Not a valid ref name, so it can
 * never collide with a real branch.
 */
export const ALL_REFS = "@all";

export interface LogQuery {
  readonly ref: string;
  readonly limit: number;
  /** Commits to walk past before collecting — the page offset. */
  readonly skip: number;
  readonly author: string | null;
  readonly grep: string | null;
  readonly regex: boolean;
  readonly caseSensitive: boolean;
  readonly after: string | null;
  readonly before: string | null;
  readonly path: string | null;
  /** Trace `path` across renames — git's `--follow`. Needs a single path. */
  readonly follow: boolean;
}

/** A content search over the working tree — the grep dialog's request. */
export interface SearchQuery {
  readonly query: string;
  readonly caseSensitive: boolean;
  /** Match only whole words — git's `-w`. */
  readonly wholeWord: boolean;
  /** Treat `query` as an extended regular expression instead of literal text. */
  readonly regex: boolean;
  readonly limit: number;
}
