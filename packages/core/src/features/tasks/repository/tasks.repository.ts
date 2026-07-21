import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type { NoRepoSelected, NotFound, StorageError } from "../../../shared.ts"
import type { Board, Card, TasksColumn } from "../schema/tasks.schema.ts"

export interface CreateCardInput {
  readonly title: string
  readonly description: string
  readonly column?: TasksColumn
}
export interface UpdateCardInput {
  readonly title?: string
  readonly description?: string
  readonly column?: TasksColumn
  readonly order?: number
}
export interface UpdateColumnInput {
  readonly name?: string
  readonly order?: number
}
export type TasksFailure = NoRepoSelected | NotFound | StorageError
export interface TasksRepo {
  readonly board: Effect.Effect<Board, TasksFailure>
  readonly create: (input: CreateCardInput) => Effect.Effect<Card, TasksFailure>
  readonly update: (
    id: string,
    input: UpdateCardInput
  ) => Effect.Effect<Card, TasksFailure>
  readonly remove: (id: string) => Effect.Effect<void, TasksFailure>
  readonly setPrefix: (prefix: string) => Effect.Effect<Board, TasksFailure>
  readonly addColumn: (name: string) => Effect.Effect<Board, TasksFailure>
  readonly updateColumn: (
    id: string,
    input: UpdateColumnInput
  ) => Effect.Effect<Board, TasksFailure>
  readonly removeColumn: (id: string) => Effect.Effect<Board, TasksFailure>
  readonly addComment: (
    cardId: string,
    body: string,
    parentId: string | null
  ) => Effect.Effect<Card, TasksFailure>
  readonly removeComment: (
    cardId: string,
    commentId: string
  ) => Effect.Effect<Card, TasksFailure>
}
export class TasksRepository extends Context.Service<
  TasksRepository,
  TasksRepo
>()("TasksRepository") {}
