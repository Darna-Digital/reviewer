import { Ok } from "@byconvo/core/shared"
import {
  NewTask,
  Task,
  TaskIdParam,
  TaskListQuery,
  TaskRefParam,
  UpdateTask,
} from "@byconvo/core/tasks"
import * as Schema from "effect/Schema"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { workspaceErrors } from "../../errors.ts"

/** Dropping a task at an index of a column — the board's one write for a drag. */
const MoveTask = Schema.Struct({
  status: Task.fields.status,
  index: Schema.Number,
})

export class TasksApi extends HttpApiGroup.make("tasks")
  .add(
    HttpApiEndpoint.get("list", "/tasks", {
      query: TaskListQuery,
      success: Schema.Array(Task),
      error: workspaceErrors,
    })
  )
  .add(
    HttpApiEndpoint.get("get", "/tasks/:id", {
      params: TaskIdParam,
      success: Task,
      error: workspaceErrors,
    })
  )
  // Agent-facing: turn "finish BYC-224" into the one task it names.
  .add(
    HttpApiEndpoint.get("resolve", "/tasks/resolve/:ref", {
      params: TaskRefParam,
      success: Task,
      error: workspaceErrors,
    })
  )
  .add(
    HttpApiEndpoint.post("create", "/tasks", {
      payload: NewTask,
      success: Task,
      error: workspaceErrors,
    })
  )
  .add(
    HttpApiEndpoint.make("PATCH")("update", "/tasks/:id", {
      params: TaskIdParam,
      payload: UpdateTask,
      success: Task,
      error: workspaceErrors,
    })
  )
  .add(
    HttpApiEndpoint.post("move", "/tasks/:id/move", {
      params: TaskIdParam,
      payload: MoveTask,
      success: Task,
      error: workspaceErrors,
    })
  )
  .add(
    HttpApiEndpoint.make("DELETE")("remove", "/tasks/:id", {
      params: TaskIdParam,
      success: Ok,
      error: workspaceErrors,
    })
  ) {}
