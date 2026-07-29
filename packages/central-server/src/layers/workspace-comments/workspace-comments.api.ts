import { Ok } from "@byconvo/core/shared"
import {
  NewWorkspaceComment,
  UpdateWorkspaceComment,
  WorkspaceComment,
  WorkspaceCommentIdParam,
  WorkspaceCommentListQuery,
} from "@byconvo/core/workspace-comments"
import * as Schema from "effect/Schema"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { workspaceErrors } from "../../errors.ts"

export class WorkspaceCommentsApi extends HttpApiGroup.make("comments")
  .add(
    HttpApiEndpoint.get("list", "/comments", {
      query: WorkspaceCommentListQuery,
      success: Schema.Array(WorkspaceComment),
      error: workspaceErrors,
    })
  )
  .add(
    HttpApiEndpoint.post("create", "/comments", {
      payload: NewWorkspaceComment,
      success: WorkspaceComment,
      error: workspaceErrors,
    })
  )
  .add(
    HttpApiEndpoint.make("PATCH")("update", "/comments/:id", {
      params: WorkspaceCommentIdParam,
      payload: UpdateWorkspaceComment,
      success: WorkspaceComment,
      error: workspaceErrors,
    })
  )
  .add(
    HttpApiEndpoint.make("DELETE")("remove", "/comments/:id", {
      params: WorkspaceCommentIdParam,
      success: Ok,
      error: workspaceErrors,
    })
  ) {}
