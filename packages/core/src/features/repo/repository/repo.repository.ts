import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { GitFailure } from "../../../ports/git-exec.ts";
import type {
  BranchInfo,
  CommitDetail,
  CommitInfo,
  ConflictBlobs,
  ContentMatches,
  DiffFileContents,
  DiffFileTarget,
  FilesPayload,
  MergeState,
  RemoteBranchInfo,
  RepoInfo,
  RepoStatus,
  LogQuery,
  SearchQuery,
} from "../schema/repo.schema.ts";

export interface RepoRepo {
  readonly info: Effect.Effect<RepoInfo, GitFailure>;
  readonly files: Effect.Effect<FilesPayload, GitFailure>;
  readonly status: Effect.Effect<RepoStatus, GitFailure>;
  readonly branches: Effect.Effect<ReadonlyArray<BranchInfo>, GitFailure>;
  readonly remoteBranches: Effect.Effect<
    ReadonlyArray<RemoteBranchInfo>,
    GitFailure
  >;
  readonly log: (
    query: LogQuery
  ) => Effect.Effect<ReadonlyArray<CommitInfo>, GitFailure>;
  /** Lines in the working tree matching `query` — the repo-wide grep. */
  readonly search: (
    query: SearchQuery
  ) => Effect.Effect<ContentMatches, GitFailure>;
  readonly commitDetail: (
    sha: string
  ) => Effect.Effect<CommitDetail, GitFailure>;
  readonly worktreeDiff: Effect.Effect<string, GitFailure>;
  readonly rangeDiff: (
    base: string,
    head: string
  ) => Effect.Effect<string, GitFailure>;
  readonly commitDiff: (sha: string) => Effect.Effect<string, GitFailure>;
  readonly diffFileContents: (
    target: DiffFileTarget,
    path: string,
    prevPath: string | null
  ) => Effect.Effect<DiffFileContents, GitFailure>;
  readonly checkout: (branch: string) => Effect.Effect<void, GitFailure>;
  readonly createBranch: (
    name: string,
    startPoint: string | null
  ) => Effect.Effect<void, GitFailure>;
  readonly commit: (
    message: string,
    paths: ReadonlyArray<string>
  ) => Effect.Effect<string, GitFailure>;
  readonly discard: (
    paths: ReadonlyArray<string>
  ) => Effect.Effect<void, GitFailure>;
  readonly discardHunk: (
    path: string,
    hunkIndex: number
  ) => Effect.Effect<void, GitFailure>;
  readonly push: Effect.Effect<string, GitFailure>;
  readonly pull: Effect.Effect<string, GitFailure>;
  readonly fetch: Effect.Effect<string, GitFailure>;
  readonly merge: (branch: string) => Effect.Effect<string, GitFailure>;
  readonly rebase: (onto: string) => Effect.Effect<string, GitFailure>;
  readonly mergeState: Effect.Effect<MergeState, GitFailure>;
  readonly conflictBlobs: (
    path: string
  ) => Effect.Effect<ConflictBlobs, GitFailure>;
  readonly resolveConflict: (
    path: string,
    resolution: "ours" | "theirs" | "content"
  ) => Effect.Effect<void, GitFailure>;
  readonly abortMerge: Effect.Effect<string, GitFailure>;
  readonly continueMerge: Effect.Effect<string, GitFailure>;
  readonly renameBranch: (
    from: string,
    to: string
  ) => Effect.Effect<void, GitFailure>;
  readonly deleteBranch: (
    name: string,
    force: boolean
  ) => Effect.Effect<void, GitFailure>;
}
export class RepoRepository extends Context.Service<RepoRepository, RepoRepo>()(
  "RepoRepository"
) {}
