import * as Clock from "effect/Clock"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import { InvalidInput, NotFound } from "../../../shared.ts"
import {
  TasksRepository,
  type TasksFailure,
  type TasksRepo,
  type UpdateTaskInput,
} from "../repository/tasks.repository.ts"
import type {
  NewTask,
  Task,
  TaskStatus,
  UpdateTask,
} from "../schema/tasks.schema.ts"
import {
  isClosed,
  nextPosition,
  positionForIndex,
  resolveTaskRef,
  sortTasks,
  wouldCycle,
} from "../functions/tasks.functions.ts"

export type TasksServiceFailure = TasksFailure | InvalidInput

export interface TasksServiceShape {
  readonly listByProject: (
    projectId: string
  ) => Effect.Effect<ReadonlyArray<Task>, TasksServiceFailure>
  readonly listAll: Effect.Effect<ReadonlyArray<Task>, TasksServiceFailure>
  readonly get: (id: string) => Effect.Effect<Task, TasksServiceFailure>
  readonly create: (
    input: NewTask
  ) => Effect.Effect<Task, TasksServiceFailure>
  readonly update: (
    id: string,
    input: UpdateTask
  ) => Effect.Effect<Task, TasksServiceFailure>
  /**
   * Drop a task at `index` of `status`, as the column reads without it.
   * The board's one write for a drag, whichever column it started in.
   */
  readonly move: (
    id: string,
    status: TaskStatus,
    index: number
  ) => Effect.Effect<Task, TasksServiceFailure>
  readonly remove: (id: string) => Effect.Effect<void, TasksServiceFailure>
  /** Resolve "BYC-224" — or a sentence containing it — to one task. */
  readonly resolveRef: (
    ref: string
  ) => Effect.Effect<Task, TasksServiceFailure>
}

export class TasksService extends Context.Service<
  TasksService,
  TasksServiceShape
>()("TasksService") {}

const now = Effect.map(Clock.currentTimeMillis, (millis) =>
  new Date(millis).toISOString()
)

/**
 * The rules a task has to obey, kept off both the HTTP layer and the database:
 * a task needs a title, cannot be parented into its own subtree, is appended to
 * the end of the column it lands in, and carries a `completedAt` stamp that
 * follows its status across the open/closed line in both directions.
 */
export const makeTasksService = Effect.gen(function* () {
  const repo: TasksRepo = yield* TasksRepository

  const requireTitle = (title: string): Effect.Effect<string, InvalidInput> => {
    const trimmed = title.trim()
    return trimmed.length === 0
      ? Effect.fail(new InvalidInput({ reason: "a task needs a title" }))
      : Effect.succeed(trimmed)
  }

  const listByProject: TasksServiceShape["listByProject"] = (projectId) =>
    Effect.map(repo.listByProject(projectId), sortTasks)

  /** Tasks sharing a column, so a new or moved task can find its neighbours. */
  const column = (
    projectId: string,
    status: TaskStatus,
    excludeId: string | null
  ) =>
    Effect.map(repo.listByProject(projectId), (tasks) =>
      sortTasks(
        tasks.filter((t) => t.status === status && t.id !== excludeId)
      )
    )

  const create: TasksServiceShape["create"] = (input) =>
    Effect.gen(function* () {
      const title = yield* requireTitle(input.title)
      const status = input.status ?? "backlog"
      const siblings = yield* column(input.projectId, status, null)
      const timestamp = yield* now
      return yield* repo.create({
        projectId: input.projectId,
        title,
        description: input.description ?? "",
        status,
        priority: input.priority ?? "none",
        parentId: input.parentId ?? null,
        position: nextPosition(siblings),
        labelIds: input.labelIds ?? [],
        completedAt: isClosed(status) ? timestamp : null,
      })
    })

  /**
   * `completedAt` only moves when the status crosses the open/closed line —
   * re-saving a done task keeps the moment it was actually finished, and
   * reopening one clears the stamp instead of leaving a stale date behind.
   */
  const completionStamp = (
    before: TaskStatus,
    after: TaskStatus | undefined
  ): Effect.Effect<{ readonly completedAt?: string | null }> => {
    if (after === undefined || isClosed(before) === isClosed(after)) {
      return Effect.succeed({})
    }
    return isClosed(after)
      ? Effect.map(now, (timestamp) => ({ completedAt: timestamp }))
      : Effect.succeed({ completedAt: null })
  }

  const update: TasksServiceShape["update"] = (id, input) =>
    Effect.gen(function* () {
      const existing = yield* repo.get(id)
      const title =
        input.title === undefined ? undefined : yield* requireTitle(input.title)

      if (input.parentId !== undefined) {
        const siblings = yield* repo.listByProject(existing.projectId)
        if (wouldCycle(siblings, id, input.parentId)) {
          return yield* Effect.fail(
            new InvalidInput({
              reason: "a task cannot be a sub-task of itself or its own sub-task",
            })
          )
        }
      }

      // Landing in a different column appends the task there, unless the
      // caller already worked out a position (a drag knows where it dropped).
      const position =
        input.position !== undefined
          ? input.position
          : input.status !== undefined && input.status !== existing.status
            ? nextPosition(
                yield* column(existing.projectId, input.status, id)
              )
            : undefined

      const stamp = yield* completionStamp(existing.status, input.status)

      const patch: UpdateTaskInput = {
        ...(title === undefined ? {} : { title }),
        ...(input.description === undefined
          ? {}
          : { description: input.description }),
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.priority === undefined ? {} : { priority: input.priority }),
        ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
        ...(position === undefined ? {} : { position }),
        ...(input.labelIds === undefined ? {} : { labelIds: input.labelIds }),
        ...stamp,
      }
      return yield* repo.update(id, patch)
    })

  const move: TasksServiceShape["move"] = (id, status, index) =>
    Effect.gen(function* () {
      const existing = yield* repo.get(id)
      const others = yield* column(existing.projectId, status, id)
      const stamp = yield* completionStamp(existing.status, status)
      return yield* repo.update(id, {
        status,
        position: positionForIndex(others, index),
        ...stamp,
      })
    })

  const resolveRef: TasksServiceShape["resolveRef"] = (ref) =>
    Effect.flatMap(repo.listAll, (tasks) => {
      const found = resolveTaskRef(tasks, ref)
      return found === null
        ? Effect.fail(new NotFound({ reason: `no task matches "${ref}"` }))
        : Effect.succeed(found)
    })

  return TasksService.of({
    listByProject,
    listAll: repo.listAll,
    get: repo.get,
    create,
    update,
    move,
    remove: repo.remove,
    resolveRef,
  })
})
