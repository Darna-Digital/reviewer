import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import { InvalidInput } from "../../../shared.ts"
import {
  ProjectsRepository,
  type ProjectsFailure,
  type ProjectsRepo,
} from "../repository/projects.repository.ts"
import type {
  NewProject,
  Project,
  UpdateProject,
} from "../schema/projects.schema.ts"
import {
  normalizeProjectKey,
  sortProjects,
  suggestProjectKey,
  uniqueProjectKey,
} from "../functions/projects.functions.ts"

export interface ProjectsServiceShape {
  /** Every project, live ones first (see `sortProjects`). */
  readonly list: Effect.Effect<
    ReadonlyArray<Project>,
    ProjectsFailure | InvalidInput
  >
  readonly get: (
    id: string
  ) => Effect.Effect<Project, ProjectsFailure | InvalidInput>
  readonly create: (
    input: NewProject
  ) => Effect.Effect<Project, ProjectsFailure | InvalidInput>
  readonly update: (
    id: string,
    input: UpdateProject
  ) => Effect.Effect<Project, ProjectsFailure | InvalidInput>
  readonly remove: (
    id: string
  ) => Effect.Effect<void, ProjectsFailure | InvalidInput>
}

export class ProjectsService extends Context.Service<
  ProjectsService,
  ProjectsServiceShape
>()("ProjectsService") {}

/**
 * Naming a project is the only real rule here: the key is what every task in
 * the project is addressed by, so it must be a normalized, unique prefix. The
 * service derives one from the name when the caller left it out, and settles
 * collisions against the keys already taken before handing the write down.
 */
export const makeProjectsService = Effect.gen(function* () {
  const repo: ProjectsRepo = yield* ProjectsRepository

  const list = Effect.map(repo.list, sortProjects)

  const resolveKey = (
    requested: string | undefined,
    name: string,
    excludeId: string | null
  ): Effect.Effect<string, ProjectsFailure> =>
    Effect.map(repo.list, (existing) => {
      const normalized = normalizeProjectKey(requested ?? "")
      const base = normalized.length > 0 ? normalized : suggestProjectKey(name)
      const taken = existing.filter((p) => p.id !== excludeId).map((p) => p.key)
      return uniqueProjectKey(base, taken)
    })

  const requireName = (name: string): Effect.Effect<string, InvalidInput> => {
    const trimmed = name.trim()
    return trimmed.length === 0
      ? Effect.fail(new InvalidInput({ reason: "a project needs a name" }))
      : Effect.succeed(trimmed)
  }

  const create: ProjectsServiceShape["create"] = (input) =>
    Effect.gen(function* () {
      const name = yield* requireName(input.name)
      const key = yield* resolveKey(input.key, name, null)
      return yield* repo.create({
        name,
        key,
        description: input.description ?? "",
        color: input.color ?? "gray",
      })
    })

  const update: ProjectsServiceShape["update"] = (id, input) =>
    Effect.gen(function* () {
      const name =
        input.name === undefined ? undefined : yield* requireName(input.name)
      // Only re-derive the key when the caller actually asked to change it;
      // renaming a project must not silently re-key every one of its tasks.
      const key =
        input.key === undefined
          ? undefined
          : yield* resolveKey(input.key, name ?? "", id)
      return yield* repo.update(id, {
        ...(name === undefined ? {} : { name }),
        ...(key === undefined ? {} : { key }),
        ...(input.description === undefined
          ? {}
          : { description: input.description }),
        ...(input.color === undefined ? {} : { color: input.color }),
        ...(input.archived === undefined ? {} : { archived: input.archived }),
      })
    })

  return ProjectsService.of({
    list,
    get: repo.get,
    create,
    update,
    remove: repo.remove,
  })
})
