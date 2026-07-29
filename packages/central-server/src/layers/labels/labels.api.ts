import {
  Label,
  LabelIdParam,
  LabelListQuery,
  NewLabel,
  UpdateLabel,
} from "@byconvo/core/labels"
import { Ok } from "@byconvo/core/shared"
import * as Schema from "effect/Schema"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { workspaceErrors } from "../../errors.ts"

export class LabelsApi extends HttpApiGroup.make("labels")
  .add(
    HttpApiEndpoint.get("list", "/labels", {
      query: LabelListQuery,
      success: Schema.Array(Label),
      error: workspaceErrors,
    })
  )
  .add(
    HttpApiEndpoint.post("create", "/labels", {
      payload: NewLabel,
      success: Label,
      error: workspaceErrors,
    })
  )
  .add(
    HttpApiEndpoint.make("PATCH")("update", "/labels/:id", {
      params: LabelIdParam,
      payload: UpdateLabel,
      success: Label,
      error: workspaceErrors,
    })
  )
  .add(
    HttpApiEndpoint.make("DELETE")("remove", "/labels/:id", {
      params: LabelIdParam,
      success: Ok,
      error: workspaceErrors,
    })
  ) {}
