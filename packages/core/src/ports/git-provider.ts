import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { CommentSide } from "../features/comments/schema/comments.schema.ts"
import type { ReviewComment } from "../features/comments/schema/comments.schema.ts"

export class GitProviderError extends Schema.TaggedErrorClass<GitProviderError>()(
  "GitProviderError",
  { reason: Schema.String },
  { httpApiStatus: 502 }
) {
  override get message(): string {
    return this.reason
  }
}

export const PullRequestInfo = Schema.Struct({
  number: Schema.Number,
  title: Schema.String,
  author: Schema.String,
  baseRef: Schema.String,
  headRef: Schema.String,
  headSha: Schema.String,
  url: Schema.String,
  updatedAt: Schema.String,
})
export type PullRequestInfo = typeof PullRequestInfo.Type

export const PullNumberParam = Schema.Struct({ number: Schema.String })
export const PullReplyParams = Schema.Struct({
  number: Schema.String,
  commentId: Schema.String,
})

export const PrComment = Schema.Struct({
  filePath: Schema.String,
  side: CommentSide,
  lineNumber: Schema.Number,
  body: Schema.String,
})
export type PrComment = typeof PrComment.Type

export const PrReply = Schema.Struct({ body: Schema.String })
export type PrReply = typeof PrReply.Type

export interface PrCommentInput {
  readonly pullNumber: number
  readonly filePath: string
  readonly side: "deletions" | "additions"
  readonly lineNumber: number
  readonly body: string
}
export interface PrReplyInput {
  readonly pullNumber: number
  readonly commentId: number
  readonly body: string
}

export interface GitProviderShape {
  readonly pulls: Effect.Effect<
    ReadonlyArray<PullRequestInfo>,
    GitProviderError
  >
  readonly pullDiff: (
    pullNumber: number
  ) => Effect.Effect<string, GitProviderError>
  readonly pullComments: (
    pullNumber: number
  ) => Effect.Effect<ReadonlyArray<ReviewComment>, GitProviderError>
  readonly createPullComment: (
    input: PrCommentInput
  ) => Effect.Effect<ReviewComment, GitProviderError>
  readonly replyToPullComment: (
    input: PrReplyInput
  ) => Effect.Effect<ReviewComment, GitProviderError>
}

export class GitProvider extends Context.Service<
  GitProvider,
  GitProviderShape
>()("GitProvider") {}

export interface GitProviderSeed {
  readonly pulls?: ReadonlyArray<PullRequestInfo>
  readonly comments?: ReadonlyArray<ReviewComment>
  readonly diff?: string
}

export const GitProviderMemory = (
  seed: GitProviderSeed = {}
): Layer.Layer<GitProvider> =>
  Layer.succeed(GitProvider)(
    GitProvider.of({
      pulls: Effect.succeed(seed.pulls ?? []),
      pullDiff: () => Effect.succeed(seed.diff ?? ""),
      pullComments: () => Effect.succeed(seed.comments ?? []),
      createPullComment: (input) =>
        Effect.succeed({
          id: "gh-new",
          filePath: input.filePath,
          side: input.side,
          lineNumber: input.lineNumber,
          body: input.body,
          author: "tester",
          createdAt: "2026-01-01T00:00:00.000Z",
          target: `pr-${input.pullNumber}`,
          source: "github",
        }),
      replyToPullComment: (input) =>
        Effect.succeed({
          id: "gh-reply",
          filePath: "",
          side: "additions",
          lineNumber: 0,
          body: input.body,
          author: "tester",
          createdAt: "2026-01-01T00:00:00.000Z",
          target: `pr-${input.pullNumber}`,
          source: "github",
        }),
    })
  )
