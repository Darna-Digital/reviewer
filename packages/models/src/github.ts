/** GitHub pull-request schemas. Review comments reuse the comments feature's
 * shape (with source="github"). */
import * as Schema from "effect/Schema"
import { CommentSide } from "./comments.ts"

export { ReviewComment } from "./comments.ts"

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

export const DiffText = Schema.String

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

/** The structured PR-comment input the repository consumes. */
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
