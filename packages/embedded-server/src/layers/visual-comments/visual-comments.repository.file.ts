import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { VisualComment } from "@byconvo/core/visual-comments"
import { NotFound, StorageError } from "@byconvo/core/shared"
import { WorkspaceContext } from "../workspace/workspace-context.ts"
import type { VisualCommentsRepo } from "@byconvo/core/visual-comments"

const VisualCommentsFile = Schema.Array(VisualComment)

const visualCommentsPath = (repoPath: string) =>
  `${repoPath}/.byconvo/visual-comments.json`

const readVisualComments = (repoPath: string): ReadonlyArray<VisualComment> => {
  try {
    const raw = readFileSync(visualCommentsPath(repoPath), "utf8")
    return Schema.decodeUnknownSync(VisualCommentsFile)(JSON.parse(raw))
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return []
    }
    throw error
  }
}

const writeVisualComments = (
  repoPath: string,
  comments: ReadonlyArray<VisualComment>
) => {
  mkdirSync(`${repoPath}/.byconvo`, { recursive: true })
  writeFileSync(
    visualCommentsPath(repoPath),
    `${JSON.stringify(comments, null, 2)}\n`
  )
}

export const makeFileVisualCommentsRepository = Effect.gen(function* () {
  const ctx = yield* WorkspaceContext

  const withFile = <A>(f: (repoPath: string) => A) =>
    Effect.flatMap(ctx.requireCurrent, (repoPath) =>
      Effect.try({
        try: () => f(repoPath),
        // A thrown NotFound is a real 404, not a storage failure — preserve it.
        catch: (error) =>
          error instanceof NotFound
            ? error
            : new StorageError({
                reason: error instanceof Error ? error.message : String(error),
              }),
      })
    )

  const list: VisualCommentsRepo["list"] = withFile((repoPath) =>
    [...readVisualComments(repoPath)].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    )
  )

  const add: VisualCommentsRepo["add"] = (input) =>
    withFile((repoPath) => {
      const created: VisualComment = {
        ...input,
        id: `v-${randomUUID()}`,
        createdAt: new Date().toISOString(),
      }
      writeVisualComments(repoPath, [...readVisualComments(repoPath), created])
      return created
    })

  const update: VisualCommentsRepo["update"] = (id, input) =>
    withFile((repoPath) => {
      const all = readVisualComments(repoPath)
      const existing = all.find((comment) => comment.id === id)
      if (existing === undefined) {
        throw new NotFound({ reason: `visual comment ${id} not found` })
      }
      const updated: VisualComment = { ...existing, body: input.body }
      writeVisualComments(
        repoPath,
        all.map((comment) => (comment.id === id ? updated : comment))
      )
      return updated
    })

  const remove: VisualCommentsRepo["remove"] = (id) =>
    withFile((repoPath) => {
      writeVisualComments(
        repoPath,
        readVisualComments(repoPath).filter((comment) => comment.id !== id)
      )
    })

  return { list, add, update, remove } satisfies VisualCommentsRepo
})
