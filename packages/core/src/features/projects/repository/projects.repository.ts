import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type { Conflict, NotFound, StorageError } from "../../../shared.ts"
import type { AccentColor, Project } from "../schema/projects.schema.ts"

export interface CreateProjectInput {
  readonly name: string
  readonly key: string
  readonly description: string
  readonly color: AccentColor
}

export interface UpdateProjectInput {
  readonly name?: string
  readonly key?: string
  readonly description?: string
  readonly color?: AccentColor
  readonly archived?: boolean
}

export type ProjectsFailure = NotFound | Conflict | StorageError

export interface ProjectsRepo {
  readonly list: Effect.Effect<ReadonlyArray<Project>, ProjectsFailure>
  readonly get: (id: string) => Effect.Effect<Project, ProjectsFailure>
  readonly create: (
    input: CreateProjectInput
  ) => Effect.Effect<Project, ProjectsFailure>
  readonly update: (
    id: string,
    input: UpdateProjectInput
  ) => Effect.Effect<Project, ProjectsFailure>
  readonly remove: (id: string) => Effect.Effect<void, ProjectsFailure>
}

export class ProjectsRepository extends Context.Service<
  ProjectsRepository,
  ProjectsRepo
>()("ProjectsRepository") {}
