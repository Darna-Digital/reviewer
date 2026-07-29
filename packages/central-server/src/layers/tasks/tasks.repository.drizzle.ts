import { Viewer } from "@byconvo/core/identity"
import { NotFound } from "@byconvo/core/shared"
import { taskKey } from "@byconvo/core/tasks"
import type {
  CreateTaskInput,
  Task,
  TasksRepo,
  UpdateTaskInput,
} from "@byconvo/core/tasks"
import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm"
import * as Effect from "effect/Effect"
import {
  Database,
  makeQueryRunner,
  type DrizzleDatabase,
} from "../../db/client.ts"
import * as schema from "../../db/schema.ts"

type Row = typeof schema.tasks.$inferSelect

const toTask = (
  row: Row,
  projectKey: string,
  labelIds: ReadonlyArray<string>
): Task => ({
  id: row.id,
  projectId: row.projectId,
  number: row.number,
  key: taskKey(projectKey, row.number),
  title: row.title,
  description: row.description,
  status: row.status,
  priority: row.priority,
  parentId: row.parentId,
  position: row.position,
  labelIds,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  completedAt: row.completedAt?.toISOString() ?? null,
})

/**
 * What the label helpers need from a connection. A transaction satisfies it as
 * well as the pool does, so they read the same inside and outside one.
 */
type Queryable = Pick<DrizzleDatabase, "select" | "insert" | "delete">

/**
 * The label ids of each task in one round trip, rather than one query per row.
 * An empty set of task ids skips the query entirely — `IN ()` is not valid SQL.
 */
const labelIdsByTask = async (
  db: Queryable,
  taskIds: ReadonlyArray<string>
): Promise<Map<string, Array<string>>> => {
  const byTask = new Map<string, Array<string>>()
  if (taskIds.length === 0) return byTask
  const rows = await db
    .select()
    .from(schema.taskLabels)
    .where(inArray(schema.taskLabels.taskId, [...taskIds]))
  for (const row of rows) {
    const existing = byTask.get(row.taskId)
    if (existing === undefined) byTask.set(row.taskId, [row.labelId])
    else existing.push(row.labelId)
  }
  return byTask
}

/** Replace a task's labels wholesale — the shape the UI's picker sends. */
const setLabels = async (
  db: Queryable,
  taskId: string,
  labelIds: ReadonlyArray<string>
): Promise<void> => {
  await db.delete(schema.taskLabels).where(eq(schema.taskLabels.taskId, taskId))
  if (labelIds.length === 0) return
  await db
    .insert(schema.taskLabels)
    .values([...new Set(labelIds)].map((labelId) => ({ taskId, labelId })))
}

export const makeDrizzleTasksRepository = Effect.gen(function* () {
  const db = yield* Database
  const run = makeQueryRunner(db)
  const { organization } = yield* Viewer
  const orgId = organization.id

  const mine = (extra?: SQL): SQL =>
    (extra === undefined
      ? eq(schema.tasks.organizationId, orgId)
      : and(eq(schema.tasks.organizationId, orgId), extra))!

  /**
   * Tasks joined to their project (for the key prefix) and hydrated with their
   * labels. Two queries, whatever the row count.
   */
  const select = (where: SQL) => async (d: DrizzleDatabase) => {
    const rows = await d
      .select({ task: schema.tasks, projectKey: schema.projects.key })
      .from(schema.tasks)
      .innerJoin(schema.projects, eq(schema.tasks.projectId, schema.projects.id))
      .where(where)
      .orderBy(asc(schema.tasks.position), asc(schema.tasks.number))
    const labels = await labelIdsByTask(
      d,
      rows.map((row) => row.task.id)
    )
    return rows.map((row) =>
      toTask(row.task, row.projectKey, labels.get(row.task.id) ?? [])
    )
  }

  const require = (id: string) =>
    Effect.flatMap(
      run("reading a task", select(mine(eq(schema.tasks.id, id)))),
      (tasks) =>
        tasks[0] === undefined
          ? Effect.fail(new NotFound({ reason: `task ${id} not found` }))
          : Effect.succeed(tasks[0])
    )

  const repo: TasksRepo = {
    listByProject: (projectId) =>
      run(
        "listing tasks",
        select(mine(eq(schema.tasks.projectId, projectId)))
      ),

    listAll: run("listing every task", select(mine())),

    get: require,

    create: (input: CreateTaskInput) =>
      Effect.flatMap(
        run("creating a task", (d) =>
          d.transaction(async (tx) => {
            // Hand out the project's next number and bump the counter in the
            // same statement, so two concurrent creates cannot take the same
            // key: the row is locked for the length of the UPDATE.
            const [project] = await tx
              .update(schema.projects)
              .set({ nextTaskNumber: sql`${schema.projects.nextTaskNumber} + 1` })
              .where(
                and(
                  eq(schema.projects.id, input.projectId),
                  eq(schema.projects.organizationId, orgId)
                )
              )
              .returning({
                key: schema.projects.key,
                number: schema.projects.nextTaskNumber,
              })
            if (project === undefined) return null

            const [row] = await tx
              .insert(schema.tasks)
              .values({
                organizationId: orgId,
                projectId: input.projectId,
                // `returning` gives the value *after* the bump, so the number
                // this task takes is the one before it.
                number: project.number - 1,
                title: input.title,
                description: input.description,
                status: input.status,
                priority: input.priority,
                parentId: input.parentId,
                position: input.position,
                completedAt:
                  input.completedAt === null
                    ? null
                    : new Date(input.completedAt),
              })
              .returning()
            if (row === undefined) return null

            await setLabels(tx, row.id, input.labelIds)
            return toTask(row, project.key, [...new Set(input.labelIds)])
          })
        ),
        (created) =>
          created === null
            ? Effect.fail(
                new NotFound({
                  reason: `project ${input.projectId} not found`,
                })
              )
            : Effect.succeed(created)
      ),

    update: (id, input: UpdateTaskInput) =>
      Effect.flatMap(require(id), () =>
        Effect.flatMap(
          run("updating a task", (d) =>
            d.transaction(async (tx) => {
              const [row] = await tx
                .update(schema.tasks)
                .set({
                  ...(input.title === undefined ? {} : { title: input.title }),
                  ...(input.description === undefined
                    ? {}
                    : { description: input.description }),
                  ...(input.status === undefined
                    ? {}
                    : { status: input.status }),
                  ...(input.priority === undefined
                    ? {}
                    : { priority: input.priority }),
                  ...(input.parentId === undefined
                    ? {}
                    : { parentId: input.parentId }),
                  ...(input.position === undefined
                    ? {}
                    : { position: input.position }),
                  ...(input.completedAt === undefined
                    ? {}
                    : {
                        completedAt:
                          input.completedAt === null
                            ? null
                            : new Date(input.completedAt),
                      }),
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(schema.tasks.id, id),
                    eq(schema.tasks.organizationId, orgId)
                  )
                )
                .returning()
              if (row === undefined) return false

              if (input.labelIds !== undefined) {
                await setLabels(tx, id, input.labelIds)
              }
              return true
            })
          ),
          // Read the task back rather than reassembling it here: the row alone
          // does not carry its project key, and an update is not hot enough to
          // be worth the duplication.
          (written) =>
            written
              ? require(id)
              : Effect.fail(new NotFound({ reason: `task ${id} not found` }))
        )
      ),

    // Sub-tasks cascade from the self-reference; the comments on the task and
    // on those sub-tasks are cleaned up by the handler that owns the delete.
    remove: (id) =>
      Effect.flatMap(require(id), () =>
        Effect.asVoid(
          run("deleting a task", (d) =>
            d.delete(schema.tasks).where(mine(eq(schema.tasks.id, id)))
          )
        )
      ),
  }

  return repo
})
