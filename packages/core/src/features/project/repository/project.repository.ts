import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { NoRepoSelected } from "../../../shared.ts";
import type { LogQuery } from "../../repo/schema/repo.schema.ts";
import type {
  ProjectBranches,
  ProjectChanges,
  ProjectFiles,
  ProjectLog,
} from "../schema/project.schema.ts";

/**
 * The project's git state across every root it holds. A root that cannot be
 * read is reported alongside the ones that could, never as a failure of the
 * whole read — one broken repository must not blank the view.
 */
export interface ProjectRepo {
  readonly changes: Effect.Effect<ProjectChanges, NoRepoSelected>;
  /** Every root's files, named from the project root. */
  readonly files: Effect.Effect<ProjectFiles, NoRepoSelected>;
  /**
   * Every root's uncommitted diff, concatenated with its paths moved under the
   * root they came from, so the whole project parses as one diff.
   */
  readonly worktreeDiff: Effect.Effect<string, NoRepoSelected>;
  readonly branches: Effect.Effect<ProjectBranches, NoRepoSelected>;
  readonly log: (query: LogQuery) => Effect.Effect<ProjectLog, NoRepoSelected>;
}

export class ProjectRepository extends Context.Service<
  ProjectRepository,
  ProjectRepo
>()("ProjectRepository") {}
