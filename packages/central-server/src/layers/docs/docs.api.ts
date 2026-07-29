import {
  Doc,
  DocIdParam,
  DocListQuery,
  DocSummary,
  NewDoc,
  UpdateDoc,
} from "@byconvo/core/docs"
import { Ok } from "@byconvo/core/shared"
import * as Schema from "effect/Schema"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { workspaceErrors } from "../../errors.ts"

export class DocsApi extends HttpApiGroup.make("docs")
  .add(
    HttpApiEndpoint.get("list", "/docs", {
      query: DocListQuery,
      success: Schema.Array(DocSummary),
      error: workspaceErrors,
    })
  )
  .add(
    HttpApiEndpoint.get("get", "/docs/:id", {
      params: DocIdParam,
      success: Doc,
      error: workspaceErrors,
    })
  )
  .add(
    HttpApiEndpoint.post("create", "/docs", {
      payload: NewDoc,
      success: Doc,
      error: workspaceErrors,
    })
  )
  .add(
    HttpApiEndpoint.make("PATCH")("update", "/docs/:id", {
      params: DocIdParam,
      payload: UpdateDoc,
      success: Doc,
      error: workspaceErrors,
    })
  )
  .add(
    HttpApiEndpoint.make("DELETE")("remove", "/docs/:id", {
      params: DocIdParam,
      success: Ok,
      error: workspaceErrors,
    })
  ) {}
