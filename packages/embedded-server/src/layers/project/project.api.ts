/** HTTP endpoints for the project's git state across every root it holds. */
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import {
  ProjectBranches,
  ProjectChanges,
  ProjectCommitBody,
  ProjectCommitResult,
  ProjectFiles,
  ProjectLog,
  ProjectMatches,
} from "@byconvo/core/project";
import * as Schema from "effect/Schema";
import { LogQueryParams, SearchQueryParams } from "@byconvo/core/repo";
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
    HttpApiEndpoint.get("files", "/project/files", {
      success: ProjectFiles,
      error: noProject,
    })
  )
  .add(
    HttpApiEndpoint.get("diff", "/project/diff", {
      success: Schema.String,
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
    HttpApiEndpoint.post("commit", "/project/commit", {
      payload: ProjectCommitBody,
      success: ProjectCommitResult,
      error: noProject,
    })
  )
  .add(
    HttpApiEndpoint.get("log", "/project/log", {
      query: LogQueryParams,
      success: ProjectLog,
      error: noProject,
    })
  )
  .add(
    HttpApiEndpoint.get("search", "/project/search", {
      query: SearchQueryParams,
      success: ProjectMatches,
      error: noProject,
    })
  ) {}
