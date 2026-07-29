import * as Effect from "effect/Effect"
import * as Ref from "effect/Ref"
import { NotFound } from "../../../shared.ts"
import type {
  CommentAuthor,
  WorkspaceComment,
} from "../schema/workspace-comments.schema.ts"
import type {
  CreateCommentInput,
  WorkspaceCommentsRepo,
} from "./workspace-comments.repository.ts"

const NOW = "2026-01-01T00:00:00.000Z"

/**
 * `authors` stands in for the join onto the member table; an unknown author id
 * still renders, so a fixture does not have to register every commenter.
 */
export const makeMemoryWorkspaceCommentsRepository = (
  seed: ReadonlyArray<WorkspaceComment> = [],
  authors: Readonly<Record<string, CommentAuthor>> = {}
) =>
  Effect.gen(function* () {
    const store = yield* Ref.make<ReadonlyArray<WorkspaceComment>>([...seed])
    let counter = seed.length

    const authorFor = (id: string): CommentAuthor =>
      authors[id] ?? { id, name: id, email: `${id}@example.com`, image: null }

    const require = (id: string) =>
      Effect.flatMap(Ref.get(store), (all) => {
        const found = all.find((c) => c.id === id)
        return found === undefined
          ? Effect.fail(new NotFound({ reason: `comment ${id} not found` }))
          : Effect.succeed(found)
      })

    /** Ids of `id` and everything replying to it, at any depth. */
    const withReplies = (
      all: ReadonlyArray<WorkspaceComment>,
      id: string
    ): ReadonlySet<string> => {
      const doomed = new Set([id])
      let grew = true
      while (grew) {
        grew = false
        for (const comment of all) {
          if (
            comment.parentId !== null &&
            doomed.has(comment.parentId) &&
            !doomed.has(comment.id)
          ) {
            doomed.add(comment.id)
            grew = true
          }
        }
      }
      return doomed
    }

    const repo: WorkspaceCommentsRepo = {
      listBySubject: (subjectType, subjectId) =>
        Effect.map(Ref.get(store), (all) =>
          all.filter(
            (c) => c.subjectType === subjectType && c.subjectId === subjectId
          )
        ),
      get: require,
      create: (input: CreateCommentInput) =>
        Effect.gen(function* () {
          counter += 1
          const created: WorkspaceComment = {
            id: `comment-mem-${counter}`,
            subjectType: input.subjectType,
            subjectId: input.subjectId,
            parentId: input.parentId,
            body: input.body,
            author: authorFor(input.authorId),
            createdAt: NOW,
            updatedAt: NOW,
            edited: false,
          }
          yield* Ref.update(store, (all) => [...all, created])
          return created
        }),
      update: (id, body) =>
        Effect.gen(function* () {
          const existing = yield* require(id)
          const updated: WorkspaceComment = {
            ...existing,
            body,
            updatedAt: NOW,
            edited: true,
          }
          yield* Ref.update(store, (all) =>
            all.map((c) => (c.id === id ? updated : c))
          )
          return updated
        }),
      // Mirrors the database's ON DELETE CASCADE on the self-reference.
      remove: (id) =>
        Effect.flatMap(require(id), () =>
          Ref.update(store, (all) => {
            const doomed = withReplies(all, id)
            return all.filter((c) => !doomed.has(c.id))
          })
        ),
    }

    return repo
  })
