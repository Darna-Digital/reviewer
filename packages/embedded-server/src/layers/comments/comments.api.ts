import * as Schema from "effect/Schema"
import {
  ReviewComment,
  CommentIdParam,
  NewComment,
  UpdateComment,
} from "@byconvo/core/comments"
import {
  NoRepoSelected,
  NotFound,
  StorageError,
  Ok,
} from "@byconvo/core/shared"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"

const storeError = [NoRepoSelected, StorageError] as const
const mutateError = [NoRepoSelected, NotFound, StorageError] as const

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
    HttpApiEndpoint.make("PATCH")("update", "/comments/:id", {
      params: CommentIdParam,
      payload: UpdateComment,
      success: ReviewComment,
      error: mutateError,
    })
  )
  .add(
    HttpApiEndpoint.make("DELETE")("remove", "/comments/:id", {
      params: CommentIdParam,
      success: Ok,
      error: storeError,
    })
  ) {}
