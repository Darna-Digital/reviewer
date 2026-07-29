import { Viewer } from "@byconvo/core/identity"
import type {
  CreateLabelInput,
  Label,
  LabelsRepo,
  UpdateLabelInput,
} from "@byconvo/core/labels"
import { Conflict, NotFound } from "@byconvo/core/shared"
import { and, asc, eq, type SQL } from "drizzle-orm"
import * as Effect from "effect/Effect"
import {
  Database,
  makeQueryRunner,
  uniqueViolationOf,
} from "../../db/client.ts"
import * as schema from "../../db/schema.ts"

type Row = typeof schema.labels.$inferSelect

const toLabel = (row: Row): Label => ({
  id: row.id,
  projectId: row.projectId,
  name: row.name,
  color: row.color,
  createdAt: row.createdAt.toISOString(),
})

/**
 * The service already refuses a duplicate name, comparing case-insensitively;
 * the table's constraint is exact, so it only fires on a genuine race.
 */
const nameTaken = (name: string | undefined) => (error: unknown) =>
  uniqueViolationOf(error) === null
    ? null
    : new Conflict({
        reason: `this project already has a "${name ?? ""}" label`,
      })

export const makeDrizzleLabelsRepository = Effect.gen(function* () {
  const db = yield* Database
  const run = makeQueryRunner(db)
  const { organization } = yield* Viewer
  const orgId = organization.id

  const mine = (extra?: SQL): SQL =>
    (extra === undefined
      ? eq(schema.labels.organizationId, orgId)
      : and(eq(schema.labels.organizationId, orgId), extra))!

  const require = (id: string) =>
    Effect.flatMap(
      run("reading a label", (d) =>
        d
          .select()
          .from(schema.labels)
          .where(mine(eq(schema.labels.id, id)))
          .limit(1)
      ),
      (rows) =>
        rows[0] === undefined
          ? Effect.fail(new NotFound({ reason: `label ${id} not found` }))
          : Effect.succeed(toLabel(rows[0]))
    )

  const repo: LabelsRepo = {
    listByProject: (projectId) =>
      run("listing labels", (d) =>
        d
          .select()
          .from(schema.labels)
          .where(mine(eq(schema.labels.projectId, projectId)))
          .orderBy(asc(schema.labels.name))
      ).pipe(Effect.map((rows) => rows.map(toLabel))),

    get: require,

    create: (input: CreateLabelInput) =>
      run(
        "creating a label",
        (d) =>
          d
            .insert(schema.labels)
            .values({
              organizationId: orgId,
              projectId: input.projectId,
              name: input.name,
              color: input.color,
            })
            .returning(),
        nameTaken(input.name)
      ).pipe(
        Effect.flatMap((rows) =>
          rows[0] === undefined
            ? Effect.fail(new NotFound({ reason: "the label was not written" }))
            : Effect.succeed(toLabel(rows[0]))
        )
      ),

    update: (id, input: UpdateLabelInput) =>
      Effect.flatMap(require(id), () =>
        run(
          "updating a label",
          (d) =>
            d
              .update(schema.labels)
              .set({
                ...(input.name === undefined ? {} : { name: input.name }),
                ...(input.color === undefined ? {} : { color: input.color }),
              })
              .where(mine(eq(schema.labels.id, id)))
              .returning(),
          nameTaken(input.name)
        ).pipe(
          Effect.flatMap((rows) =>
            rows[0] === undefined
              ? Effect.fail(new NotFound({ reason: `label ${id} not found` }))
              : Effect.succeed(toLabel(rows[0]))
          )
        )
      ),

    // The join rows cascade, so deleting a label unpins it from every task.
    remove: (id) =>
      Effect.flatMap(require(id), () =>
        Effect.asVoid(
          run("deleting a label", (d) =>
            d.delete(schema.labels).where(mine(eq(schema.labels.id, id)))
          )
        )
      ),
  }

  return repo
})
