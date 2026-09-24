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
  /**
   * Who writes here — git's `user.name`, the name the commits carry. A note
   * filed from the app is signed with it, so the composer shows it before the
   * server has. "you" when git has no name set.
   */
  user: Schema.String,
});
export type RepoInfo = typeof RepoInfo.Type;
/**
 * The identity git signs commits with here — `user.name` and `user.email` as
 * the repository resolves them, its own config over the global one. Null where
 * git has nothing set, unlike `RepoInfo.user`, which stands in with "you": a
 * settings screen wants to say the name is missing, not sign for it.
 */
export const GitIdentity = Schema.Struct({
  name: Schema.NullOr(Schema.String),
  email: Schema.NullOr(Schema.String),
});
export type GitIdentity = typeof GitIdentity.Type;
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
 * Where a branch's work is aimed. Git has no such notion — a branch knows its
 * tip and its upstream, never what it is meant to land on — so the answer is
 * recorded once, when the branch is made, and every diff of that branch is read
 * against it.
 *
 * Kept per branch rather than per checkout: a branch aimed at `development` is
 * aimed there whichever repository of the project it is read from.
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
/**
 * Every file in the open repository, and what git makes of each.
 *
 * The listing names the repository it lists. A client holds this answer and
 * the repository's identity as two separate readings, and a project switch
 * replaces them a moment apart — so for that moment one of them is still the
 * project just left. Anything deciding what a repository holds (a strip of
 * open files, a tree) has to be able to tell the two apart, and `root` is how:
 * the same `rev-parse --show-toplevel` `RepoInfo.root` carries, so the two can
 * simply be compared.
 */
export const FilesPayload = Schema.Struct({
  root: Schema.String,
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
});
export type DiffQuery = typeof DiffQuery.Type;
export const DiffFileQuery = Schema.Struct({
  path: Schema.String,
  prevPath: Schema.optionalKey(Schema.String),
  commit: Schema.optionalKey(Schema.String),
  base: Schema.optionalKey(Schema.String),
  head: Schema.optionalKey(Schema.String),
  target: Schema.optionalKey(Schema.String),
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
/**
 * Check out a pull request's head locally. The local branch name is the
 * caller's to choose: a pull request from a fork must not be allowed to land on
 * the branch of the same name here — see `localBranchForPull` in the app.
 */
export const CheckoutPull = Schema.Struct({
  number: Schema.Number,
  branch: Schema.String,
});
export type CheckoutPull = typeof CheckoutPull.Type;
export const CheckedOutBranch = Schema.Struct({ branch: Schema.String });
export type CheckedOutBranch = typeof CheckedOutBranch.Type;
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
  | { readonly kind: "branch"; readonly target: string };

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
