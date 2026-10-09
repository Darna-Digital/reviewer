import * as Schema from "effect/Schema";
import { ReviewComment } from "@reviewer/core/comments";
import {
  CloseResult,
  GitHubAuth,
  GitHubLoginState,
  GitHubRepoQuery,
  GitProviderError,
  MergePullRequest,
  MergeResult,
  PullRequestInfo,
  PrComment,
  PrReply,
  PullNumberParam,
  PullCommentParams,
  PullThreadParams,
  ThreadResolution,
} from "@reviewer/core/ports/git-provider";
import { DiffText, Ok } from "@reviewer/core/shared";
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

export class GitHubApi extends HttpApiGroup.make("github")
  .add(
    HttpApiEndpoint.get("auth", "/github/auth", {
      success: GitHubAuth,
      error: GitProviderError,
    })
  )
  .add(
    HttpApiEndpoint.post("startLogin", "/github/login", {
      success: GitHubLoginState,
      error: GitProviderError,
    })
  )
  .add(
    HttpApiEndpoint.get("loginStatus", "/github/login", {
      success: GitHubLoginState,
    })
  )
  .add(
    HttpApiEndpoint.make("DELETE")("cancelLogin", "/github/login", {
      success: GitHubLoginState,
    })
  )
  .add(
    HttpApiEndpoint.get("pulls", "/github/pulls", {
      query: GitHubRepoQuery,
      success: Schema.Array(PullRequestInfo),
      error: GitProviderError,
    })
  )
  .add(
    HttpApiEndpoint.post("mergePull", "/github/pulls/:number/merge", {
      params: PullNumberParam,
      query: GitHubRepoQuery,
      payload: MergePullRequest,
      success: MergeResult,
      error: GitProviderError,
    })
  )
  .add(
    HttpApiEndpoint.post("closePull", "/github/pulls/:number/close", {
      params: PullNumberParam,
      query: GitHubRepoQuery,
      success: CloseResult,
      error: GitProviderError,
    })
  )
  .add(
    HttpApiEndpoint.get("pullDiff", "/github/pulls/:number/diff", {
      params: PullNumberParam,
      query: GitHubRepoQuery,
      success: DiffText,
      error: GitProviderError,
    })
  )
  .add(
    HttpApiEndpoint.get("pullComments", "/github/pulls/:number/comments", {
      params: PullNumberParam,
      query: GitHubRepoQuery,
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
        query: GitHubRepoQuery,
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
        query: GitHubRepoQuery,
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
        query: GitHubRepoQuery,
        success: Ok,
        error: GitProviderError,
      }
    )
  )
  .add(
    HttpApiEndpoint.put(
      "setPullThreadResolved",
      "/github/pulls/:number/threads/:threadId",
      {
        params: PullThreadParams,
        query: GitHubRepoQuery,
        payload: ThreadResolution,
        success: Ok,
        error: GitProviderError,
      }
    )
  ) {}
