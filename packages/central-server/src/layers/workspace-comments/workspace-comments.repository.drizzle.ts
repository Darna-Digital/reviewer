import { Viewer } from "@byconvo/core/identity"
import { NotFound } from "@byconvo/core/shared"
import type {
  CreateCommentInput,
  WorkspaceComment,
  WorkspaceCommentsRepo,
} from "@byconvo/core/workspace-comments"
import { and, asc, eq, type SQL } from "drizzle-orm"
import * as Effect from "effect/Effect"
import {
  Database,
  makeQueryRunner,
  type DrizzleDatabase,
} from "../../db/client.ts"
import * as schema from "../../db/schema.ts"

type Row = typeof schema.workspaceComments.$inferSelect
type AuthorRow = Pick<
  typeof schema.user.$inferSelect,
  "id" | "name" | "email" | "image"
>

const toComment = (row: Row, author: AuthorRow): WorkspaceComment => ({
  id: row.id,
  subjectType: row.subjectType,
  subjectId: row.subjectId,
  parentId: row.parentId,
  body: row.body,
  author: {
    id: author.id,
    name: author.name,
    email: author.email,
    image: author.image,
  },
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  edited: row.edited,
})

export const makeDrizzleWorkspaceCommentsRepository = Effect.gen(function* () {
  const db = yield* Database
  const run = makeQueryRunner(db)
  const { organization } = yield* Viewer
  const orgId = organization.id

  const mine = (extra?: SQL): SQL =>
    (extra === undefined
      ? eq(schema.workspaceComments.organizationId, orgId)
      : and(eq(schema.workspaceComments.organizationId, orgId), extra))!

  /** Comments with their author joined on, oldest first. */
  const select = (where: SQL) => (d: DrizzleDatabase) =>
    d
      .select({
        comment: schema.workspaceComments,
        author: {
          id: schema.user.id,
          name: schema.user.name,
          email: schema.user.email,
          image: schema.user.image,
        },
      })
      .from(schema.workspaceComments)
      .innerJoin(
        schema.user,
        eq(schema.workspaceComments.authorId, schema.user.id)
      )
      .where(where)
      .orderBy(asc(schema.workspaceComments.createdAt))

  const require = (id: string) =>
    Effect.flatMap(
      run(
        "reading a comment",
        select(mine(eq(schema.workspaceComments.id, id)))
      ),
      (rows) =>
        rows[0] === undefined
          ? Effect.fail(new NotFound({ reason: `comment ${id} not found` }))
          : Effect.succeed(toComment(rows[0].comment, rows[0].author))
    )

  const repo: WorkspaceCommentsRepo = {
    listBySubject: (subjectType, subjectId) =>
      run(
        "listing comments",
        select(
          mine(
            and(
              eq(schema.workspaceComments.subjectType, subjectType),
              eq(schema.workspaceComments.subjectId, subjectId)
            )!
          )
        )
      ).pipe(
        Effect.map((rows) =>
          rows.map((row) => toComment(row.comment, row.author))
        )
      ),

    get: require,

    create: (input: CreateCommentInput) =>
      Effect.flatMap(
        run("posting a comment", (d) =>
          d
            .insert(schema.workspaceComments)
            .values({
              organizationId: orgId,
              subjectType: input.subjectType,
              subjectId: input.subjectId,
              parentId: input.parentId,
              body: input.body,
              authorId: input.authorId,
            })
            .returning({ id: schema.workspaceComments.id })
        ),
        (rows) =>
          rows[0] === undefined
            ? Effect.fail(
                new NotFound({ reason: "the comment was not written" })
              )
            : require(rows[0].id)
      ),

    update: (id, body) =>
      Effect.flatMap(
        run("editing a comment", (d) =>
          d
            .update(schema.workspaceComments)
            .set({ body, edited: true, updatedAt: new Date() })
            .where(mine(eq(schema.workspaceComments.id, id)))
            .returning({ id: schema.workspaceComments.id })
        ),
        (rows) =>
          rows[0] === undefined
            ? Effect.fail(new NotFound({ reason: `comment ${id} not found` }))
            : require(id)
      ),

    // Replies cascade from the self-reference.
    remove: (id) =>
      Effect.flatMap(require(id), () =>
        Effect.asVoid(
          run("deleting a comment", (d) =>
            d
              .delete(schema.workspaceComments)
              .where(mine(eq(schema.workspaceComments.id, id)))
          )
        )
      ),
  }

  return repo
})
