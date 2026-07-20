/** GitHub PR repository contract. */
import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type { GitHubError } from "../../../layers/errors.ts"
import type { ReviewComment } from "@byconvo/models/comments"
import type {
  PullRequestInfo,
  PrCommentInput,
  PrReplyInput,
} from "@byconvo/models/github"

export interface GitHubRepo {
  readonly pulls: Effect.Effect<ReadonlyArray<PullRequestInfo>, GitHubError>
  readonly pullDiff: (pullNumber: number) => Effect.Effect<string, GitHubError>
  readonly pullComments: (
    pullNumber: number
  ) => Effect.Effect<ReadonlyArray<ReviewComment>, GitHubError>
  readonly createPullComment: (
    input: PrCommentInput
  ) => Effect.Effect<ReviewComment, GitHubError>
  readonly replyToPullComment: (
    input: PrReplyInput
  ) => Effect.Effect<ReviewComment, GitHubError>
}

export class GitHubRepository extends Context.Service<
  GitHubRepository,
  GitHubRepo
>()("GitHubRepository") {}
