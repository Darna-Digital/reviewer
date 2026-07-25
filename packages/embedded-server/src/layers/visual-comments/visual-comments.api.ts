import * as Schema from "effect/Schema"
import { NoRepoSelected, Ok, StorageError } from "@byconvo/core/shared"
import {
  EmptyCommentBody,
  NewVisualComment,
  VisualComment,
  VisualCommentIdParam,
} from "@byconvo/core/visual-comments"
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/unstable/httpapi"

const errors = [NoRepoSelected, StorageError] as const

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
    HttpApiEndpoint.make("DELETE")("remove", "/visual-comments/:id", {
      params: VisualCommentIdParam,
      success: Ok,
      error: errors,
    })
  ) {}
