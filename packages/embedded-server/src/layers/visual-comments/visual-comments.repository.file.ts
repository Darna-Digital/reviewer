import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { VisualComment } from "@byconvo/core/visual-comments"
import { StorageError } from "@byconvo/core/shared"
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

// Module-scoped so ids stay unique even though the repository is built per
// request (a request-scoped closure counter would reset and could collide).
let counter = 0

export const makeFileVisualCommentsRepository = Effect.gen(function* () {
  const ctx = yield* WorkspaceContext

  const withFile = <A>(f: (repoPath: string) => A) =>
    Effect.flatMap(ctx.requireCurrent, (repoPath) =>
      Effect.try({
        try: () => f(repoPath),
        catch: (error) =>
          new StorageError({
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
      counter += 1
      const created: VisualComment = {
        ...input,
        id: `v-${Date.now().toString(36)}-${counter}`,
        createdAt: new Date().toISOString(),
      }
      writeVisualComments(repoPath, [...readVisualComments(repoPath), created])
      return created
    })

  const remove: VisualCommentsRepo["remove"] = (id) =>
    withFile((repoPath) => {
      writeVisualComments(
        repoPath,
        readVisualComments(repoPath).filter((comment) => comment.id !== id)
      )
    })

  return { list, add, remove } satisfies VisualCommentsRepo
})
