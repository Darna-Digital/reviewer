import * as Schema from "effect/Schema"
import {
  NoRepoSelected,
  NotFound,
  Ok,
  StorageError,
} from "@byconvo/core/shared"
import {
  EmptyCommentBody,
  NewVisualComment,
  UpdateVisualComment,
  VisualComment,
  VisualCommentIdParam,
} from "@byconvo/core/visual-comments"
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/unstable/httpapi"

// The repository types every operation with the same failure union
// (VisualCommentsFailure), so each endpoint declares all three.
const errors = [NoRepoSelected, NotFound, StorageError] as const

const JavaScript = Schema.String.pipe(
  HttpApiSchema.asText({ contentType: "application/javascript; charset=utf-8" })
)

export class VisualCommentsApi extends HttpApiGroup.make("visualComments")
  .add(
    HttpApiEndpoint.get("picker", "/visual-comments/picker.js", {
      success: JavaScript,
    })
  )
  .add(
    HttpApiEndpoint.get("list", "/visual-comments", {
      success: Schema.Array(VisualComment),
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.post("add", "/visual-comments", {
      payload: NewVisualComment,
      success: VisualComment,
      error: [...errors, EmptyCommentBody],
    })
  )
  .add(
    HttpApiEndpoint.make("PATCH")("update", "/visual-comments/:id", {
      params: VisualCommentIdParam,
      payload: UpdateVisualComment,
      success: VisualComment,
      error: [...errors, EmptyCommentBody],
    })
  )
  .add(
    HttpApiEndpoint.make("DELETE")("remove", "/visual-comments/:id", {
      params: VisualCommentIdParam,
      success: Ok,
      error: errors,
    })
  ) {}
