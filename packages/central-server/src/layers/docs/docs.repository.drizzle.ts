import type {
  CreateDocInput,
  Doc,
  DocSummary,
  DocsRepo,
  UpdateDocInput,
} from "@byconvo/core/docs"
import { Viewer } from "@byconvo/core/identity"
import { NotFound } from "@byconvo/core/shared"
import { and, desc, eq, type SQL } from "drizzle-orm"
import * as Effect from "effect/Effect"
import { Database, makeQueryRunner } from "../../db/client.ts"
import * as schema from "../../db/schema.ts"

type Row = typeof schema.docs.$inferSelect

const toDoc = (row: Row): Doc => ({
  id: row.id,
  projectId: row.projectId,
  title: row.title,
  content: row.content,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

export const makeDrizzleDocsRepository = Effect.gen(function* () {
  const db = yield* Database
  const run = makeQueryRunner(db)
  const { organization } = yield* Viewer
  const orgId = organization.id

  const mine = (extra?: SQL): SQL =>
    (extra === undefined
      ? eq(schema.docs.organizationId, orgId)
      : and(eq(schema.docs.organizationId, orgId), extra))!

  const require = (id: string) =>
    Effect.flatMap(
      run("reading a doc", (d) =>
        d
          .select()
          .from(schema.docs)
          .where(mine(eq(schema.docs.id, id)))
          .limit(1)
      ),
      (rows) =>
        rows[0] === undefined
          ? Effect.fail(new NotFound({ reason: `doc ${id} not found` }))
          : Effect.succeed(toDoc(rows[0]))
    )

  const repo: DocsRepo = {
    // The list view never needs the bodies, and a workspace's docs can be long.
    listByProject: (projectId) =>
      run("listing docs", (d) =>
        d
          .select({
            id: schema.docs.id,
            projectId: schema.docs.projectId,
            title: schema.docs.title,
            updatedAt: schema.docs.updatedAt,
          })
          .from(schema.docs)
          .where(mine(eq(schema.docs.projectId, projectId)))
          .orderBy(desc(schema.docs.updatedAt))
      ).pipe(
        Effect.map(
          (rows): ReadonlyArray<DocSummary> =>
            rows.map((row) => ({
              id: row.id,
              projectId: row.projectId,
              title: row.title,
              updatedAt: row.updatedAt.toISOString(),
            }))
        )
      ),

    get: require,

    create: (input: CreateDocInput) =>
      run("creating a doc", (d) =>
        d
          .insert(schema.docs)
          .values({
            organizationId: orgId,
            projectId: input.projectId,
            title: input.title,
            content: input.content,
          })
          .returning()
      ).pipe(
        Effect.flatMap((rows) =>
          rows[0] === undefined
            ? Effect.fail(new NotFound({ reason: "the doc was not written" }))
            : Effect.succeed(toDoc(rows[0]))
        )
      ),

    update: (id, input: UpdateDocInput) =>
      run("updating a doc", (d) =>
        d
          .update(schema.docs)
          .set({
            ...(input.title === undefined ? {} : { title: input.title }),
            ...(input.content === undefined ? {} : { content: input.content }),
            updatedAt: new Date(),
          })
          .where(mine(eq(schema.docs.id, id)))
          .returning()
      ).pipe(
        Effect.flatMap((rows) =>
          rows[0] === undefined
            ? Effect.fail(new NotFound({ reason: `doc ${id} not found` }))
            : Effect.succeed(toDoc(rows[0]))
        )
      ),

    remove: (id) =>
      Effect.flatMap(require(id), () =>
        Effect.asVoid(
          run("deleting a doc", (d) =>
            d.delete(schema.docs).where(mine(eq(schema.docs.id, id)))
          )
        )
      ),
  }

  return repo
})
