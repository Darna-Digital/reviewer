import * as Schema from "effect/Schema";
import { ReviewComment } from "@reviewer/core/comments";
import {
  CloseResult,
  GitProviderError,
  MergePullRequest,
  MergeResult,
  PullRequestInfo,
  PrComment,
  PrReply,
  PullNumberParam,
  PullCommentParams,
} from "@reviewer/core/ports/git-provider";
import { DiffText, Ok } from "@reviewer/core/shared";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

export class GitHubApi extends HttpApiGroup.make("github")
  .add(
    HttpApiEndpoint.get("pulls", "/github/pulls", {
      success: Schema.Array(PullRequestInfo),
      error: GitProviderError,
    })
  )
  .add(
    HttpApiEndpoint.post("mergePull", "/github/pulls/:number/merge", {
      params: PullNumberParam,
      payload: MergePullRequest,
      success: MergeResult,
      error: GitProviderError,
    })
  )
  .add(
    HttpApiEndpoint.post("closePull", "/github/pulls/:number/close", {
      params: PullNumberParam,
      success: CloseResult,
      error: GitProviderError,
    })
  )
  .add(
    HttpApiEndpoint.get("pullDiff", "/github/pulls/:number/diff", {
      params: PullNumberParam,
      success: DiffText,
      error: GitProviderError,
    })
  )
  .add(
    HttpApiEndpoint.get("pullComments", "/github/pulls/:number/comments", {
      params: PullNumberParam,
      success: Schema.Array(ReviewComment),
      error: GitProviderError,
    })
  )
  .add(
    HttpApiEndpoint.post(
      "createPullComment",
      "/github/pulls/:number/comments",
      {
        params: PullNumberParam,
        payload: PrComment,
        success: ReviewComment,
        error: GitProviderError,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      "replyPullComment",
      "/github/pulls/:number/comments/:commentId/replies",
      {
        params: PullCommentParams,
        payload: PrReply,
        success: ReviewComment,
        error: GitProviderError,
      }
    )
  )
  .add(
    HttpApiEndpoint.make("DELETE")(
      "deletePullComment",
      "/github/pulls/:number/comments/:commentId",
      {
        params: PullCommentParams,
        success: Ok,
        error: GitProviderError,
      }
    )
  ) {}
