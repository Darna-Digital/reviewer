/**
 * Git domain schemas — repo info, file status, branches, commits, the
 * status-bar snapshot.
 */
import * as Schema from "effect/Schema"

export const GitFileStatus = Schema.Literals([
  "added",
  "deleted",
  "ignored",
  "modified",
  "renamed",
  "untracked",
])
export type GitFileStatus = typeof GitFileStatus.Type

export const GitStatusEntry = Schema.Struct({
  path: Schema.String,
  status: GitFileStatus,
})
export type GitStatusEntry = typeof GitStatusEntry.Type

export const GitHubRemote = Schema.Struct({
  owner: Schema.String,
  repo: Schema.String,
})
export type GitHubRemote = typeof GitHubRemote.Type

export const RepoInfo = Schema.Struct({
  root: Schema.String,
  name: Schema.String,
  currentBranch: Schema.String,
  remoteUrl: Schema.NullOr(Schema.String),
  github: Schema.NullOr(GitHubRemote),
})
export type RepoInfo = typeof RepoInfo.Type

export const BranchInfo = Schema.Struct({
  name: Schema.String,
  sha: Schema.String,
  isCurrent: Schema.Boolean,
  upstream: Schema.NullOr(Schema.String),
  ahead: Schema.Number,
  behind: Schema.Number,
  committedAt: Schema.String,
  subject: Schema.String,
})
export type BranchInfo = typeof BranchInfo.Type

export const RemoteBranchInfo = Schema.Struct({
  name: Schema.String,
  remote: Schema.String,
  shortName: Schema.String,
  sha: Schema.String,
  committedAt: Schema.String,
  subject: Schema.String,
})
export type RemoteBranchInfo = typeof RemoteBranchInfo.Type

export const CommitInfo = Schema.Struct({
  sha: Schema.String,
  shortSha: Schema.String,
  author: Schema.String,
  authoredAt: Schema.String,
  subject: Schema.String,
  refs: Schema.Array(Schema.String),
  parents: Schema.Array(Schema.String),
})
export type CommitInfo = typeof CommitInfo.Type

export const CommitFileChange = Schema.Struct({
  path: Schema.String,
  status: GitFileStatus,
  oldPath: Schema.NullOr(Schema.String),
})
export type CommitFileChange = typeof CommitFileChange.Type

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
  containingBranches: Schema.Array(Schema.String),
})
export type CommitDetail = typeof CommitDetail.Type

export const FilesPayload = Schema.Struct({
  paths: Schema.Array(Schema.String),
  gitStatus: Schema.Array(GitStatusEntry),
})
export type FilesPayload = typeof FilesPayload.Type

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
})
export type RepoStatus = typeof RepoStatus.Type

/** Output of a porcelain command (push/pull/fetch/merge/rebase). */
export const CommandOutput = Schema.Struct({ output: Schema.String })
export type CommandOutput = typeof CommandOutput.Type

/** Result of a commit — the new short sha. */
export const CommitResult = Schema.Struct({ sha: Schema.String })
export type CommitResult = typeof CommitResult.Type

/** Raw unified diff text. */
export const DiffText = Schema.String
export type DiffText = typeof DiffText.Type

export const Ok = Schema.Struct({ ok: Schema.Boolean })

/** How a file conflicts, derived from the porcelain v2 `u` sub-codes. */
export const ConflictKind = Schema.Literals([
  "both-modified",
  "both-added",
  "both-deleted",
  "added-by-us",
  "added-by-them",
  "deleted-by-us",
  "deleted-by-them",
])
export type ConflictKind = typeof ConflictKind.Type

export const ConflictedFile = Schema.Struct({
  path: Schema.String,
  kind: ConflictKind,
})
export type ConflictedFile = typeof ConflictedFile.Type

export const MergeOperation = Schema.Literals([
  "merge",
  "rebase",
  "cherry-pick",
  "revert",
  "none",
])
export type MergeOperation = typeof MergeOperation.Type

/**
 * The in-progress merge/rebase/etc. operation, with the files still conflicted.
 * `operation` is `"none"` when the worktree is not mid-operation.
 */
export const MergeState = Schema.Struct({
  operation: MergeOperation,
  /** The ref/commit being brought in (the "theirs" side), if known. */
  incoming: Schema.NullOr(Schema.String),
  /** The branch the operation is replaying onto (the "ours" side), if known. */
  onto: Schema.NullOr(Schema.String),
  conflicted: Schema.Array(ConflictedFile),
})
export type MergeState = typeof MergeState.Type

/** The three index stages of a conflicted file (base may be absent). */
export const ConflictBlobs = Schema.Struct({
  path: Schema.String,
  base: Schema.NullOr(Schema.String),
  ours: Schema.String,
  theirs: Schema.String,
})
export type ConflictBlobs = typeof ConflictBlobs.Type

/** `git log` filters as they arrive on the query string (all optional). */
export const LogQueryParams = Schema.Struct({
  ref: Schema.optionalKey(Schema.String),
  limit: Schema.optionalKey(Schema.String),
  author: Schema.optionalKey(Schema.String),
  grep: Schema.optionalKey(Schema.String),
  regex: Schema.optionalKey(Schema.String),
  case: Schema.optionalKey(Schema.String),
  after: Schema.optionalKey(Schema.String),
  before: Schema.optionalKey(Schema.String),
  path: Schema.optionalKey(Schema.String),
})
export type LogQueryParams = typeof LogQueryParams.Type

/** Selects which diff to render: a commit, a range, or (neither) the worktree. */
export const DiffQuery = Schema.Struct({
  commit: Schema.optionalKey(Schema.String),
  base: Schema.optionalKey(Schema.String),
  head: Schema.optionalKey(Schema.String),
})
export type DiffQuery = typeof DiffQuery.Type

export const CommitParam = Schema.Struct({ sha: Schema.String })

export const Checkout = Schema.Struct({ branch: Schema.String })
export type Checkout = typeof Checkout.Type

export const CommitBody = Schema.Struct({
  message: Schema.String,
  paths: Schema.optionalKey(Schema.Array(Schema.String)),
})
export type CommitBody = typeof CommitBody.Type

/** Discard the worktree changes for the given paths (revert them to HEAD). */
export const Discard = Schema.Struct({
  paths: Schema.Array(Schema.String),
})
export type Discard = typeof Discard.Type

/**
 * Discard a single hunk of a file's worktree diff. `hunkIndex` is zero-based in
 * the order the hunks appear in `git diff HEAD -- <path>`, which matches the
 * order the client renders them.
 */
export const DiscardHunk = Schema.Struct({
  path: Schema.String,
  hunkIndex: Schema.Int,
})
export type DiscardHunk = typeof DiscardHunk.Type

export const Merge = Schema.Struct({ branch: Schema.String })
export type Merge = typeof Merge.Type

export const Rebase = Schema.Struct({ onto: Schema.String })
export type Rebase = typeof Rebase.Type

/** Selects a conflicted file (query param for fetching its index stages). */
export const ConflictParam = Schema.Struct({ path: Schema.String })
export type ConflictParam = typeof ConflictParam.Type

/**
 * Resolve a conflicted file. `ours`/`theirs` check out that side; `content`
 * stages whatever the client has already written to disk (see PUT /api/file).
 */
export const ResolveConflict = Schema.Struct({
  path: Schema.String,
  resolution: Schema.Literals(["ours", "theirs", "content"]),
})
export type ResolveConflict = typeof ResolveConflict.Type

export const CreateBranch = Schema.Struct({
  name: Schema.String,
  startPoint: Schema.optionalKey(Schema.String),
})
export type CreateBranch = typeof CreateBranch.Type

export const RenameBranch = Schema.Struct({
  from: Schema.String,
  to: Schema.String,
})
export type RenameBranch = typeof RenameBranch.Type

export const DeleteBranch = Schema.Struct({
  name: Schema.String,
  force: Schema.optionalKey(Schema.Boolean),
})
export type DeleteBranch = typeof DeleteBranch.Type

/** The structured log query the repository consumes (built from LogQueryParams). */
export interface LogQuery {
  readonly ref: string
  readonly limit: number
  readonly author: string | null
  readonly grep: string | null
  readonly regex: boolean
  readonly caseSensitive: boolean
  readonly after: string | null
  readonly before: string | null
  readonly path: string | null
}
