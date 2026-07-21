import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type { GitHubError } from "../errors.ts"
import type { ReviewComment } from "../../comments/schema/comments.schema.ts"
import type {
  PullRequestInfo,
  PrCommentInput,
  PrReplyInput,
} from "../schema/github.schema.ts"

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
