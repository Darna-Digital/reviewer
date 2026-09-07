import * as Schema from "effect/Schema";
import {
  NoRepoSelected,
  NotFound,
  StorageError,
  Ok,
} from "@reviewer/core/shared";
import {
  VisualComment,
  VisualCommentIdParam,
  NewVisualComment,
  UpdateVisualComment,
} from "@reviewer/core/visual-comments";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

const errors = [NoRepoSelected, NotFound, StorageError] as const;

export class VisualCommentsApi extends HttpApiGroup.make("visualComments")
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
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.make("PATCH")("update", "/visual-comments/:id", {
      params: VisualCommentIdParam,
      payload: UpdateVisualComment,
      success: VisualComment,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.make("DELETE")("remove", "/visual-comments/:id", {
      params: VisualCommentIdParam,
      success: Ok,
      error: errors,
    })
  ) {}
