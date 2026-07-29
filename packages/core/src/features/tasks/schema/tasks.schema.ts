import * as Schema from "effect/Schema"

/**
 * Where a task sits in its lifecycle. `paused` is the one that is not simply a
 * point on the line — it parks work that started and stopped, which is why the
 * board shows it next to the in-flight states rather than back in the backlog.
 */
export const TaskStatus = Schema.Literals([
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "paused",
  "done",
  "canceled",
])
export type TaskStatus = typeof TaskStatus.Type

export const TaskPriority = Schema.Literals([
  "none",
  "low",
  "medium",
  "high",
  "urgent",
])
export type TaskPriority = typeof TaskPriority.Type

export const Task = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  /** Per-project counter; the second half of the task key. */
  number: Schema.Number,
  /** "BYC-224" — the project key and number, denormalized for display. */
  key: Schema.String,
  title: Schema.String,
  description: Schema.String,
  status: TaskStatus,
  priority: TaskPriority,
  /** The task this one is a sub-task of, or null at the top level. */
  parentId: Schema.NullOr(Schema.String),
  /** Sort key within a status column. Fractional, so a move is one write. */
  position: Schema.Number,
  labelIds: Schema.Array(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  /** When the task first reached a closed status; null while it is open. */
  completedAt: Schema.NullOr(Schema.String),
})
export type Task = typeof Task.Type

export const NewTask = Schema.Struct({
  projectId: Schema.String,
  title: Schema.String,
  description: Schema.optionalKey(Schema.String),
  status: Schema.optionalKey(TaskStatus),
  priority: Schema.optionalKey(TaskPriority),
  parentId: Schema.optionalKey(Schema.NullOr(Schema.String)),
  labelIds: Schema.optionalKey(Schema.Array(Schema.String)),
})
export type NewTask = typeof NewTask.Type

export const UpdateTask = Schema.Struct({
  title: Schema.optionalKey(Schema.String),
  description: Schema.optionalKey(Schema.String),
  status: Schema.optionalKey(TaskStatus),
  priority: Schema.optionalKey(TaskPriority),
  parentId: Schema.optionalKey(Schema.NullOr(Schema.String)),
  position: Schema.optionalKey(Schema.Number),
  labelIds: Schema.optionalKey(Schema.Array(Schema.String)),
})
export type UpdateTask = typeof UpdateTask.Type

export const TaskIdParam = Schema.Struct({ id: Schema.String })
export const TaskRefParam = Schema.Struct({ ref: Schema.String })
export const TaskListQuery = Schema.Struct({ projectId: Schema.String })
