import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { NoRepoSelected } from "../../../shared.ts";
import type { LogQuery } from "../../repo/schema/repo.schema.ts";
import type {
  ProjectBranches,
  ProjectChanges,
  ProjectLog,
} from "../schema/project.schema.ts";

/**
 * The project's git state across every root it holds. A root that cannot be
 * read is reported alongside the ones that could, never as a failure of the
 * whole read — one broken repository must not blank the view.
 */
export interface ProjectRepo {
  readonly changes: Effect.Effect<ProjectChanges, NoRepoSelected>;
  readonly branches: Effect.Effect<ProjectBranches, NoRepoSelected>;
  readonly log: (query: LogQuery) => Effect.Effect<ProjectLog, NoRepoSelected>;
}

export class ProjectRepository extends Context.Service<
  ProjectRepository,
  ProjectRepo
>()("ProjectRepository") {}
