import * as Effect from "effect/Effect"
import * as Ref from "effect/Ref"
import { NotFound } from "../../../shared.ts"
import { descendantIds, taskKey } from "../functions/tasks.functions.ts"
import type { Task } from "../schema/tasks.schema.ts"
import type {
  CreateTaskInput,
  TasksRepo,
  UpdateTaskInput,
} from "./tasks.repository.ts"

const NOW = "2026-01-01T00:00:00.000Z"

/**
 * `projectKeys` maps a project id to its key so the in-memory store can build
 * task keys the same way the database view does. Ids the map does not know
 * fall back to "T", which keeps a seeded fixture usable without a project.
 */
export const makeMemoryTasksRepository = (
  seed: ReadonlyArray<Task> = [],
  projectKeys: Readonly<Record<string, string>> = {}
) =>
  Effect.gen(function* () {
    const store = yield* Ref.make<ReadonlyArray<Task>>([...seed])
    let counter = seed.length

    const require = (id: string) =>
      Effect.flatMap(Ref.get(store), (all) => {
        const found = all.find((t) => t.id === id)
        return found === undefined
          ? Effect.fail(new NotFound({ reason: `task ${id} not found` }))
          : Effect.succeed(found)
      })

    const repo: TasksRepo = {
      listByProject: (projectId) =>
        Effect.map(Ref.get(store), (all) =>
          all.filter((t) => t.projectId === projectId)
        ),
      listAll: Ref.get(store),
      get: require,
      create: (input: CreateTaskInput) =>
        Effect.gen(function* () {
          counter += 1
          const created: Task = {
            id: `task-mem-${counter}`,
            projectId: input.projectId,
            number: counter,
            key: taskKey(projectKeys[input.projectId] ?? "T", counter),
            title: input.title,
            description: input.description,
            status: input.status,
            priority: input.priority,
            parentId: input.parentId,
            position: input.position,
            labelIds: [...input.labelIds],
            createdAt: NOW,
            updatedAt: NOW,
            completedAt: input.completedAt,
          }
          yield* Ref.update(store, (all) => [...all, created])
          return created
        }),
      update: (id, input: UpdateTaskInput) =>
        Effect.gen(function* () {
          const existing = yield* require(id)
          const updated: Task = {
            ...existing,
            title: input.title ?? existing.title,
            description: input.description ?? existing.description,
            status: input.status ?? existing.status,
            priority: input.priority ?? existing.priority,
            parentId:
              input.parentId === undefined ? existing.parentId : input.parentId,
            position: input.position ?? existing.position,
            labelIds:
              input.labelIds === undefined
                ? existing.labelIds
                : [...input.labelIds],
            completedAt:
              input.completedAt === undefined
                ? existing.completedAt
                : input.completedAt,
            updatedAt: NOW,
          }
          yield* Ref.update(store, (all) =>
            all.map((t) => (t.id === id ? updated : t))
          )
          return updated
        }),
      // Mirrors the database's ON DELETE CASCADE on the self-reference.
      remove: (id) =>
        Effect.flatMap(require(id), () =>
          Ref.update(store, (all) => {
            const doomed = new Set([id, ...descendantIds(all, id)])
            return all.filter((t) => !doomed.has(t.id))
          })
        ),
    }

    return repo
  })
