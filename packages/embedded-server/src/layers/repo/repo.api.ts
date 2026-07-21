/** HTTP endpoints for git: repo info, files, branches, log, diff, commit, sync. */
import { DiffText, Ok } from "@byconvo/core/shared"
import * as Schema from "effect/Schema"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { GitError, NoRepoSelected } from "@byconvo/core/errors"
import {
  BranchInfo,
  CommandOutput,
  CommitDetail,
  CommitInfo,
  CommitResult,
  ConflictBlobs,
  FilesPayload,
  MergeState,
  RemoteBranchInfo,
  RepoInfo,
  RepoStatus,
  Checkout,
  CommitBody,
  CommitParam,
  ConflictParam,
  CreateBranch,
  DeleteBranch,
  DiffQuery,
  Discard,
  DiscardHunk,
  LogQueryParams,
  Merge,
  Rebase,
  RenameBranch,
  ResolveConflict,
} from "@byconvo/core/repo"

const gitError = [GitError, NoRepoSelected] as const

export class RepoApi extends HttpApiGroup.make("repo")
  .add(
    HttpApiEndpoint.get("info", "/repo", { success: RepoInfo, error: gitError })
  )
  .add(
    HttpApiEndpoint.get("files", "/files", {
      success: FilesPayload,
      error: gitError,
    })
  )
  .add(
    HttpApiEndpoint.get("status", "/status", {
      success: RepoStatus,
      error: gitError,
    })
  )
  .add(
    HttpApiEndpoint.get("branches", "/branches", {
      success: Schema.Array(BranchInfo),
      error: gitError,
    })
  )
  .add(
    HttpApiEndpoint.get("remoteBranches", "/remote-branches", {
      success: Schema.Array(RemoteBranchInfo),
      error: gitError,
    })
  )
  .add(
    HttpApiEndpoint.get("log", "/log", {
      query: LogQueryParams,
      success: Schema.Array(CommitInfo),
      error: gitError,
    })
  )
  .add(
    HttpApiEndpoint.get("commitDetail", "/commit/:sha", {
      params: CommitParam,
      success: CommitDetail,
      error: gitError,
    })
  )
  .add(
    HttpApiEndpoint.get("diff", "/diff", {
      query: DiffQuery,
      success: DiffText,
      error: gitError,
    })
  )
  .add(
    HttpApiEndpoint.post("checkout", "/checkout", {
      payload: Checkout,
      success: Ok,
      error: gitError,
    })
  )
  .add(
    HttpApiEndpoint.post("commit", "/commit", {
      payload: CommitBody,
      success: CommitResult,
      error: gitError,
    })
  )
  .add(
    HttpApiEndpoint.post("discard", "/discard", {
      payload: Discard,
      success: Ok,
      error: gitError,
    })
  )
  .add(
    HttpApiEndpoint.post("discardHunk", "/discard-hunk", {
      payload: DiscardHunk,
      success: Ok,
      error: gitError,
    })
  )
  .add(
    HttpApiEndpoint.post("push", "/push", {
      success: CommandOutput,
      error: gitError,
    })
  )
  .add(
    HttpApiEndpoint.post("pull", "/pull", {
      success: CommandOutput,
      error: gitError,
    })
  )
  .add(
    HttpApiEndpoint.post("fetch", "/fetch", {
      success: CommandOutput,
      error: gitError,
    })
  )
  .add(
    HttpApiEndpoint.post("merge", "/merge", {
      payload: Merge,
      success: CommandOutput,
      error: gitError,
    })
  )
  .add(
    HttpApiEndpoint.post("rebase", "/rebase", {
      payload: Rebase,
      success: CommandOutput,
      error: gitError,
    })
  )
  .add(
    HttpApiEndpoint.get("mergeState", "/merge-state", {
      success: MergeState,
      error: gitError,
    })
  )
  .add(
    HttpApiEndpoint.get("conflict", "/conflict", {
      query: ConflictParam,
      success: ConflictBlobs,
      error: gitError,
    })
  )
  .add(
    HttpApiEndpoint.post("resolveConflict", "/conflicts/resolve", {
      payload: ResolveConflict,
      success: Ok,
      error: gitError,
    })
  )
  .add(
    HttpApiEndpoint.post("abortMerge", "/merge/abort", {
      success: CommandOutput,
      error: gitError,
    })
  )
  .add(
    HttpApiEndpoint.post("continueMerge", "/merge/continue", {
      success: CommandOutput,
      error: gitError,
    })
  )
  .add(
    HttpApiEndpoint.post("createBranch", "/branch", {
      payload: CreateBranch,
      success: Ok,
      error: gitError,
    })
  )
  .add(
    HttpApiEndpoint.post("renameBranch", "/branch/rename", {
      payload: RenameBranch,
      success: Ok,
      error: gitError,
    })
  )
  .add(
    HttpApiEndpoint.post("deleteBranch", "/branch/delete", {
      payload: DeleteBranch,
      success: Ok,
      error: gitError,
    })
  ) {}
