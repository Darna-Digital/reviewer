import {
  NewProject,
  Project,
  ProjectIdParam,
  UpdateProject,
} from "@byconvo/core/projects"
import { Ok } from "@byconvo/core/shared"
import * as Schema from "effect/Schema"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { workspaceErrors } from "../../errors.ts"

export class ProjectsApi extends HttpApiGroup.make("projects")
  .add(
    HttpApiEndpoint.get("list", "/projects", {
      success: Schema.Array(Project),
      error: workspaceErrors,
    })
  )
  .add(
    HttpApiEndpoint.get("get", "/projects/:id", {
      params: ProjectIdParam,
      success: Project,
      error: workspaceErrors,
    })
  )
  .add(
    HttpApiEndpoint.post("create", "/projects", {
      payload: NewProject,
      success: Project,
      error: workspaceErrors,
    })
  )
  .add(
    HttpApiEndpoint.make("PATCH")("update", "/projects/:id", {
      params: ProjectIdParam,
      payload: UpdateProject,
      success: Project,
      error: workspaceErrors,
    })
  )
  .add(
    HttpApiEndpoint.make("DELETE")("remove", "/projects/:id", {
      params: ProjectIdParam,
      success: Ok,
      error: workspaceErrors,
    })
  ) {}
