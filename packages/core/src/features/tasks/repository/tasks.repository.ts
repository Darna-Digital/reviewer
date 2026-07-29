import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type { Conflict, NotFound, StorageError } from "../../../shared.ts"
import type { Task, TaskPriority, TaskStatus } from "../schema/tasks.schema.ts"

export interface CreateTaskInput {
  readonly projectId: string
  readonly title: string
  readonly description: string
  readonly status: TaskStatus
  readonly priority: TaskPriority
  readonly parentId: string | null
  readonly position: number
  readonly labelIds: ReadonlyArray<string>
  /** Set when the task is created straight into a closed status. */
  readonly completedAt: string | null
}

export interface UpdateTaskInput {
  readonly title?: string
  readonly description?: string
  readonly status?: TaskStatus
  readonly priority?: TaskPriority
  readonly parentId?: string | null
  readonly position?: number
  readonly labelIds?: ReadonlyArray<string>
  /** `null` clears the stamp when a closed task is reopened. */
  readonly completedAt?: string | null
}

export type TasksFailure = NotFound | Conflict | StorageError

export interface TasksRepo {
  readonly listByProject: (
    projectId: string
  ) => Effect.Effect<ReadonlyArray<Task>, TasksFailure>
  /** Every task in the tenant, for cross-project reference resolution. */
  readonly listAll: Effect.Effect<ReadonlyArray<Task>, TasksFailure>
  readonly get: (id: string) => Effect.Effect<Task, TasksFailure>
  readonly create: (input: CreateTaskInput) => Effect.Effect<Task, TasksFailure>
  readonly update: (
    id: string,
    input: UpdateTaskInput
  ) => Effect.Effect<Task, TasksFailure>
  /** Deletes the task and, with it, its sub-tasks and comments. */
  readonly remove: (id: string) => Effect.Effect<void, TasksFailure>
}

export class TasksRepository extends Context.Service<
  TasksRepository,
  TasksRepo
>()("TasksRepository") {}
