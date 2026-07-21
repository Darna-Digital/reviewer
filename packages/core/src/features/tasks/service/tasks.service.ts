import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import { NotFound } from "../../../shared.ts"
import {
  TasksRepository,
  type TasksFailure,
  type TasksRepo,
} from "../repository/tasks.repository.ts"
import type { Card, TaskCommentResolution } from "../schema/tasks.schema.ts"
import { resolveTask } from "../functions/tasks.functions.ts"

export interface TasksServiceShape extends TasksRepo {
  readonly listTasks: Effect.Effect<ReadonlyArray<Card>, TasksFailure>
  readonly resolveTask: (ref: string) => Effect.Effect<Card, TasksFailure>
  readonly resolveComment: (
    commentId: string
  ) => Effect.Effect<TaskCommentResolution, TasksFailure>
}
export class TasksService extends Context.Service<
  TasksService,
  TasksServiceShape
>()("TasksService") {}
export const makeTasksService = Effect.gen(function* () {
  const repo = yield* TasksRepository
  const listTasks = Effect.map(repo.board, (board) => board.cards)
  const resolve: TasksServiceShape["resolveTask"] = (ref) =>
    Effect.flatMap(repo.board, (board) => {
      const found = resolveTask(board.cards, ref)
      return found === null
        ? Effect.fail(new NotFound({ reason: `no task matches "${ref}"` }))
        : Effect.succeed(found)
    })
  const resolveComment: TasksServiceShape["resolveComment"] = (commentId) =>
    Effect.flatMap(repo.board, (board) => {
      for (const card of board.cards) {
        const comment = card.comments.find((c) => c.id === commentId)
        if (comment !== undefined) return Effect.succeed({ card, comment })
      }
      return Effect.fail(
        new NotFound({ reason: `no comment matches "${commentId}"` })
      )
    })
  return TasksService.of({
    ...repo,
    listTasks,
    resolveTask: resolve,
    resolveComment,
  })
})
