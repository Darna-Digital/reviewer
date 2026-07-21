import * as Schema from "effect/Schema"
import { ReviewComment } from "@byconvo/core/comments"
import {
  GitProviderError,
  PullRequestInfo,
  PrComment,
  PrReply,
  PullNumberParam,
  PullReplyParams,
} from "@byconvo/core/ports/git-provider"
import { DiffText } from "@byconvo/core/shared"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"

export class GitHubApi extends HttpApiGroup.make("github")
  .add(
    HttpApiEndpoint.get("pulls", "/github/pulls", {
      success: Schema.Array(PullRequestInfo),
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
        params: PullReplyParams,
        payload: PrReply,
        success: ReviewComment,
        error: GitProviderError,
      }
    )
  ) {}
