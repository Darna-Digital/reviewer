/** HTTP endpoints for the project's git state across every root it holds. */
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import {
  ProjectBranches,
  ProjectChanges,
  ProjectLog,
} from "@byconvo/core/project";
import { LogQueryParams } from "@byconvo/core/repo";
import { NoRepoSelected } from "@byconvo/core/shared";

const noProject = [NoRepoSelected] as const;

export class ProjectApi extends HttpApiGroup.make("project")
  .add(
    HttpApiEndpoint.get("changes", "/project/changes", {
      success: ProjectChanges,
      error: noProject,
    })
  )
  .add(
    HttpApiEndpoint.get("branches", "/project/branches", {
      success: ProjectBranches,
      error: noProject,
    })
  )
  .add(
    HttpApiEndpoint.get("log", "/project/log", {
      query: LogQueryParams,
      success: ProjectLog,
      error: noProject,
    })
  ) {}
