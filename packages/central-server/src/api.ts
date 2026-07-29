import { HttpApi } from "effect/unstable/httpapi"
import { DocsApi } from "./layers/docs/docs.api.ts"
import { LabelsApi } from "./layers/labels/labels.api.ts"
import { ProjectsApi } from "./layers/projects/projects.api.ts"
import { TasksApi } from "./layers/tasks/tasks.api.ts"
import { WorkspaceCommentsApi } from "./layers/workspace-comments/workspace-comments.api.ts"

/**
 * The central API. Served under `/api`, alongside better-auth's own routes at
 * `/api/auth/*` — which are mounted directly on the router rather than
 * described here, because the library owns their shapes.
 */
export class Api extends HttpApi.make("byconvo-central")
  .add(ProjectsApi)
  .add(TasksApi)
  .add(DocsApi)
  .add(LabelsApi)
  .add(WorkspaceCommentsApi)
  .prefix("/api") {}
