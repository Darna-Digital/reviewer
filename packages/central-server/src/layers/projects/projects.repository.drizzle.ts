import { Viewer } from "@byconvo/core/identity"
import type {
  CreateProjectInput,
  Project,
  ProjectsRepo,
  UpdateProjectInput,
} from "@byconvo/core/projects"
import { Conflict, NotFound } from "@byconvo/core/shared"
import { and, asc, eq, type SQL } from "drizzle-orm"
import * as Effect from "effect/Effect"
import {
  Database,
  makeQueryRunner,
  uniqueViolationOf,
} from "../../db/client.ts"
import * as schema from "../../db/schema.ts"

type Row = typeof schema.projects.$inferSelect

const toProject = (row: Row): Project => ({
  id: row.id,
  key: row.key,
  name: row.name,
  description: row.description,
  color: row.color,
  archived: row.archived,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

/**
 * The service settles key collisions against the keys already taken before it
 * writes, so reaching the constraint means two creates raced. Reporting it as
 * a conflict lets the caller retry instead of seeing a 500.
 */
const keyTaken = (key: string | undefined) => (error: unknown) =>
  uniqueViolationOf(error) === null
    ? null
    : new Conflict({ reason: `project key ${key ?? ""} is taken` })

export const makeDrizzleProjectsRepository = Effect.gen(function* () {
  const db = yield* Database
  const run = makeQueryRunner(db)
  const { organization } = yield* Viewer
  const orgId = organization.id

  /** Every query is bound to the viewer's organization, without exception. */
  const mine = (extra?: SQL): SQL =>
    (extra === undefined
      ? eq(schema.projects.organizationId, orgId)
      : and(eq(schema.projects.organizationId, orgId), extra))!

  const require = (id: string) =>
    Effect.flatMap(
      run("reading a project", (d) =>
        d
          .select()
          .from(schema.projects)
          .where(mine(eq(schema.projects.id, id)))
          .limit(1)
      ),
      (rows) =>
        rows[0] === undefined
          ? Effect.fail(new NotFound({ reason: `project ${id} not found` }))
          : Effect.succeed(toProject(rows[0]))
    )

  const repo: ProjectsRepo = {
    list: run("listing projects", (d) =>
      d
        .select()
        .from(schema.projects)
        .where(mine())
        .orderBy(asc(schema.projects.name))
    ).pipe(Effect.map((rows) => rows.map(toProject))),

    get: require,

    create: (input: CreateProjectInput) =>
      run(
        "creating a project",
        (d) =>
          d
            .insert(schema.projects)
            .values({
              organizationId: orgId,
              key: input.key,
              name: input.name,
              description: input.description,
              color: input.color,
            })
            .returning(),
        keyTaken(input.key)
      ).pipe(
        Effect.flatMap((rows) =>
          rows[0] === undefined
            ? Effect.fail(new NotFound({ reason: "the project was not written" }))
            : Effect.succeed(toProject(rows[0]))
        )
      ),

    update: (id, input: UpdateProjectInput) =>
      Effect.flatMap(require(id), () =>
        run(
          "updating a project",
          (d) =>
            d
              .update(schema.projects)
              .set({
                ...(input.name === undefined ? {} : { name: input.name }),
                ...(input.key === undefined ? {} : { key: input.key }),
                ...(input.description === undefined
                  ? {}
                  : { description: input.description }),
                ...(input.color === undefined ? {} : { color: input.color }),
                ...(input.archived === undefined
                  ? {}
                  : { archived: input.archived }),
                updatedAt: new Date(),
              })
              .where(mine(eq(schema.projects.id, id)))
              .returning(),
          keyTaken(input.key)
        ).pipe(
          Effect.flatMap((rows) =>
            rows[0] === undefined
              ? Effect.fail(new NotFound({ reason: `project ${id} not found` }))
              : Effect.succeed(toProject(rows[0]))
          )
        )
      ),

    // Tasks, labels and docs all cascade from the project row.
    remove: (id) =>
      Effect.flatMap(require(id), () =>
        Effect.asVoid(
          run("deleting a project", (d) =>
            d.delete(schema.projects).where(mine(eq(schema.projects.id, id)))
          )
        )
      ),
  }

  return repo
})
