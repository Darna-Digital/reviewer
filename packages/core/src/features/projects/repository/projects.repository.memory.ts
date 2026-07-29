import * as Effect from "effect/Effect"
import * as Ref from "effect/Ref"
import { Conflict, NotFound } from "../../../shared.ts"
import type { Project } from "../schema/projects.schema.ts"
import type {
  CreateProjectInput,
  ProjectsRepo,
  UpdateProjectInput,
} from "./projects.repository.ts"

/** Fixed so tests can assert on timestamps without freezing the clock. */
const NOW = "2026-01-01T00:00:00.000Z"

export const makeMemoryProjectsRepository = (
  seed: ReadonlyArray<Project> = []
) =>
  Effect.gen(function* () {
    const store = yield* Ref.make<ReadonlyArray<Project>>([...seed])
    let counter = seed.length

    const require = (id: string) =>
      Effect.flatMap(Ref.get(store), (all) => {
        const found = all.find((p) => p.id === id)
        return found === undefined
          ? Effect.fail(new NotFound({ reason: `project ${id} not found` }))
          : Effect.succeed(found)
      })

    const repo: ProjectsRepo = {
      list: Ref.get(store),
      get: require,
      create: (input: CreateProjectInput) =>
        Effect.gen(function* () {
          const all = yield* Ref.get(store)
          if (all.some((p) => p.key === input.key)) {
            return yield* Effect.fail(
              new Conflict({ reason: `project key ${input.key} is taken` })
            )
          }
          counter += 1
          const created: Project = {
            id: `project-mem-${counter}`,
            key: input.key,
            name: input.name,
            description: input.description,
            color: input.color,
            archived: false,
            createdAt: NOW,
            updatedAt: NOW,
          }
          yield* Ref.update(store, (list) => [...list, created])
          return created
        }),
      update: (id, input: UpdateProjectInput) =>
        Effect.gen(function* () {
          const existing = yield* require(id)
          const all = yield* Ref.get(store)
          if (
            input.key !== undefined &&
            all.some((p) => p.id !== id && p.key === input.key)
          ) {
            return yield* Effect.fail(
              new Conflict({ reason: `project key ${input.key} is taken` })
            )
          }
          const updated: Project = {
            ...existing,
            name: input.name ?? existing.name,
            key: input.key ?? existing.key,
            description: input.description ?? existing.description,
            color: input.color ?? existing.color,
            archived: input.archived ?? existing.archived,
            updatedAt: NOW,
          }
          yield* Ref.update(store, (list) =>
            list.map((p) => (p.id === id ? updated : p))
          )
          return updated
        }),
      remove: (id) =>
        Effect.flatMap(require(id), () =>
          Ref.update(store, (list) => list.filter((p) => p.id !== id))
        ),
    }

    return repo
  })
