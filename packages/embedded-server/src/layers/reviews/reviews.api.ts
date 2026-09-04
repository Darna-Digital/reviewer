import * as Schema from "effect/Schema";
import { ReviewComment } from "@byconvo/core/comments";
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
} from "@byconvo/core/ports/git-provider";
import { DiffText, Ok } from "@byconvo/core/shared";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

/**
 * The review endpoints — the requests open against this repository, whoever
 * hosts it. A pull request on GitHub and a merge request on GitLab are the
 * same thing under two names, so there is one group for both and `origin`
 * decides which system answers; see `reviews.layer.live.ts`.
 */
export class ReviewsApi extends HttpApiGroup.make("reviews")
  .add(
    HttpApiEndpoint.get("pulls", "/reviews/pulls", {
      success: Schema.Array(PullRequestInfo),
      error: GitProviderError,
    })
  )
  .add(
    HttpApiEndpoint.post("mergePull", "/reviews/pulls/:number/merge", {
      params: PullNumberParam,
      payload: MergePullRequest,
      success: MergeResult,
      error: GitProviderError,
    })
  )
  .add(
    HttpApiEndpoint.post("closePull", "/reviews/pulls/:number/close", {
      params: PullNumberParam,
      success: CloseResult,
      error: GitProviderError,
    })
  )
  .add(
    HttpApiEndpoint.get("pullDiff", "/reviews/pulls/:number/diff", {
      params: PullNumberParam,
      success: DiffText,
      error: GitProviderError,
    })
  )
  .add(
    HttpApiEndpoint.get("pullComments", "/reviews/pulls/:number/comments", {
      params: PullNumberParam,
      success: Schema.Array(ReviewComment),
      error: GitProviderError,
    })
  )
  .add(
    HttpApiEndpoint.post(
      "createPullComment",
      "/reviews/pulls/:number/comments",
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
      "/reviews/pulls/:number/comments/:commentId/replies",
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
      "/reviews/pulls/:number/comments/:commentId",
      {
        params: PullCommentParams,
        success: Ok,
        error: GitProviderError,
      }
    )
  ) {}
