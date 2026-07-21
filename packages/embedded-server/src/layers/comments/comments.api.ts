import * as Schema from "effect/Schema"
import {
  ReviewComment,
  CommentIdParam,
  NewComment,
} from "@byconvo/core/comments"
import { NoRepoSelected, StorageError } from "@byconvo/core/errors"
import { Ok } from "@byconvo/core/shared"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"

const storeError = [NoRepoSelected, StorageError] as const

export class CommentsApi extends HttpApiGroup.make("comments")
  .add(
    HttpApiEndpoint.get("list", "/comments", {
      success: Schema.Array(ReviewComment),
      error: storeError,
    })
  )
  .add(
    HttpApiEndpoint.post("add", "/comments", {
      payload: NewComment,
      success: ReviewComment,
      error: storeError,
    })
  )
  .add(
    HttpApiEndpoint.make("DELETE")("remove", "/comments/:id", {
      params: CommentIdParam,
      success: Ok,
      error: storeError,
    })
  ) {}
